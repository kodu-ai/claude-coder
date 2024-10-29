import { koduSSEResponse } from "../../../shared/kodu"
import { ApiHistoryItem } from "../types"
import { ChunkProcessor } from "../chunk-proccess"
import { isTextBlock } from "../utils"
import { ToolExecutor } from "../tools/tool-executor"
import { StateManager } from "../state-manager"
import { ClaudeSay, V1ClaudeMessage } from "@/shared/ExtensionMessage"

export class StreamProcessor {
	private streamPaused: boolean = false
	private accumulatedText: string = ""
	private currentReplyId: number | null = null
	private isRequestCancelled: boolean = false
	private isAborting: boolean = false

	constructor(
		private readonly stateManager: StateManager,
		private readonly toolExecutor: ToolExecutor,
		private readonly say: (
			type: ClaudeSay,
			text?: string,
			images?: string[],
			sayTs?: number,
			options?: Partial<V1ClaudeMessage>
		) => Promise<number>,
		private readonly updateWebview: () => Promise<void>
	) {}

	public pauseStream() {
		if (!this.streamPaused) {
			this.streamPaused = true
			// Ensure any accumulated content is processed before pausing
			if (this.currentReplyId !== null && this.accumulatedText) {
				this.processAccumulatedText(this.currentReplyId)
			}
		}
	}

	public resumeStream() {
		if (this.streamPaused) {
			this.streamPaused = false
		}
	}

	private async processAccumulatedText(currentReplyId: number) {
		if (!this.accumulatedText.trim()) {
			return
		}

		await this.stateManager.appendToClaudeMessage(currentReplyId, this.accumulatedText)
		await this.updateWebview()
		this.accumulatedText = ""
	}

	public async processStream(
		stream: AsyncGenerator<koduSSEResponse, any, unknown>,
		startedReqId: number,
		apiHistoryItem: ApiHistoryItem
	): Promise<void> {
		if (this.isRequestCancelled || this.isAborting) {
			return
		}

		try {
			const currentReplyId = await this.say("text", "", undefined, Date.now(), { isSubMessage: true })
			this.currentReplyId = currentReplyId

			const processor = new ChunkProcessor({
				onImmediateEndOfStream: async (chunk) => {
					if (this.isRequestCancelled || this.isAborting) {
						return
					}

					if (chunk.code === 1) {
						const { inputTokens, outputTokens, cacheCreationInputTokens, cacheReadInputTokens } =
							chunk.body.internal
						await this.stateManager.updateClaudeMessage(startedReqId, {
							...this.stateManager.getMessageById(startedReqId)!,
							apiMetrics: {
								cost: chunk.body.internal.cost,
								inputTokens,
								outputTokens,
								inputCacheRead: cacheReadInputTokens,
								inputCacheWrite: cacheCreationInputTokens,
							},
							isDone: true,
							isFetching: false,
						})
						await this.updateWebview()
					}

					if (chunk.code === -1) {
						await this.stateManager.updateClaudeMessage(startedReqId, {
							...this.stateManager.getMessageById(startedReqId)!,
							isDone: true,
							isFetching: false,
							errorText: chunk.body.msg ?? "Internal Server Error",
							isError: true,
						})
						await this.updateWebview()
						throw new Error(chunk.body.msg ?? "Internal Server Error")
					}
				},

				onChunk: async (chunk) => {
					if (this.isRequestCancelled || this.isAborting) {
						return
					}

					if (chunk.code === 2) {
						// Update API history first
						if (Array.isArray(apiHistoryItem.content) && isTextBlock(apiHistoryItem.content[0])) {
							apiHistoryItem.content[0].text =
								apiHistoryItem.content[0].text ===
								"the response was interrupted in the middle of processing"
									? chunk.body.text
									: apiHistoryItem.content[0].text + chunk.body.text
							void this.stateManager.updateApiHistoryItem(startedReqId, apiHistoryItem)
						}

						// Process chunk only if stream is not paused
						if (!this.streamPaused) {
							// Accumulate text until we have a complete XML tag or enough non-XML content
							this.accumulatedText += chunk.body.text

							// Process for tool use and get non-XML text
							const nonXMLText = await this.toolExecutor.processToolUse(this.accumulatedText)
							this.accumulatedText = "" // Clear accumulated text after processing

							// If we got non-XML text, append it to Claude message
							if (nonXMLText) {
								void this.stateManager.appendToClaudeMessage(this.currentReplyId!, nonXMLText)
								void this.updateWebview()
							}

							const hasActiveTools = await this.toolExecutor.hasActiveTools()
							if (hasActiveTools) {
								this.pauseStream()
								// Wait for tool processing to complete
								await this.toolExecutor.waitForToolProcessing()
								// Resume stream after tool processing
								this.resumeStream()
								const newReplyId = await this.say("text", "", undefined, Date.now(), {
									isSubMessage: true,
								})
								this.currentReplyId = newReplyId
							}
						}
					}
				},

				onFinalEndOfStream: async () => {
					if (this.isRequestCancelled || this.isAborting) {
						return
					}

					// Process any remaining accumulated text
					if (this.accumulatedText) {
						const nonXMLText = await this.toolExecutor.processToolUse(this.accumulatedText)
						if (nonXMLText) {
							await this.stateManager.appendToClaudeMessage(currentReplyId, nonXMLText)
							await this.updateWebview()
						}
					}

					// Ensure all tools are processed
					await this.toolExecutor.waitForToolProcessing()

					// Process any final text
					if (this.accumulatedText) {
						await this.processAccumulatedText(currentReplyId)
					}
					this.currentReplyId = null
				},
			})

			await processor.processStream(stream)
		} catch (error) {
			if (this.isRequestCancelled || this.isAborting) {
				throw error
			}
			throw error
		}
	}

	public setRequestCancelled(cancelled: boolean) {
		this.isRequestCancelled = cancelled
	}

	public setAborting(aborting: boolean) {
		this.isAborting = aborting
	}
}
