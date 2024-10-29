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
	private bufferedContent: string = ""
	private currentReplyId: number | null = null
	private isRequestCancelled: boolean = false
	private isAborting: boolean = false
	private isProcessingTool: boolean = false

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

	private async processAccumulatedText(currentReplyId: number): Promise<void> {
		if (!this.accumulatedText.trim()) {
			return
		}

		try {
			this.isProcessingTool = true

			// Let the tool parser handle the text and return any non-tool content
			const nonToolText = await this.toolExecutor.processToolUse(this.accumulatedText)

			// If we have a tool being processed, buffer any non-tool text
			if (await this.toolExecutor.hasActiveTools()) {
				if (nonToolText) {
					this.bufferedContent += nonToolText
				}

				this.streamPaused = true

				// Wait for current tool(s) to complete
				await this.toolExecutor.waitForToolProcessing()

				// Create new message section after tool processing
				const newReplyId = await this.say("text", "", undefined, Date.now(), {
					isSubMessage: true,
				})
				this.currentReplyId = newReplyId

				// If we have buffered content, append it all at once
				if (this.bufferedContent) {
					await this.stateManager.appendToClaudeMessage(this.currentReplyId!, this.bufferedContent)
					await this.updateWebview()
					this.bufferedContent = ""
				}

				this.streamPaused = false
			} else if (nonToolText) {
				// Only append text if we're not processing any tools
				await this.stateManager.appendToClaudeMessage(currentReplyId, nonToolText)
				await this.updateWebview()
			}

			// Clear accumulated text after processing
			this.accumulatedText = ""
		} finally {
			this.isProcessingTool = false
		}
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

						if (this.streamPaused) {
							// If stream is paused due to tool processing, buffer the content
							this.bufferedContent += chunk.body.text
						} else {
							// Accumulate text
							this.accumulatedText += chunk.body.text

							// Only process if we're not already processing a tool
							if (!this.isProcessingTool) {
								await this.processAccumulatedText(this.currentReplyId!)
							}
						}
					}
				},

				onFinalEndOfStream: async () => {
					if (this.isRequestCancelled || this.isAborting) {
						return
					}

					try {
						// Process any remaining text
						if (this.accumulatedText) {
							await this.processAccumulatedText(this.currentReplyId!)
						}

						// Wait for any remaining tools to complete
						if (await this.toolExecutor.hasActiveTools()) {
							await this.toolExecutor.waitForToolProcessing()
						}

						// Process any final buffered content after all tools complete
						if (this.bufferedContent) {
							await this.stateManager.appendToClaudeMessage(this.currentReplyId!, this.bufferedContent)
							await this.updateWebview()
							this.bufferedContent = ""
						}
					} finally {
						this.currentReplyId = null
					}
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

	public reset() {
		this.streamPaused = false
		this.accumulatedText = ""
		this.bufferedContent = ""
		this.currentReplyId = null
		this.isRequestCancelled = false
		this.isAborting = false
		this.isProcessingTool = false
	}
}
