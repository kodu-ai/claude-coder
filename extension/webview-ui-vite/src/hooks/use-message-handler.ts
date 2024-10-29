import { ChatState } from "@/components/chat-view/chat"
import { useCallback, useEffect, useRef, useState } from "react"
import { ClaudeMessage, ExtensionMessage, isV1ClaudeMessage } from "../../../src/shared/ExtensionMessage"
import { ChatTool } from "../../../src/shared/new-tools"
import { Resource } from "../../../src/shared/WebviewMessage"
import { useEvent } from "react-use"

export const useChatMessageHandling = (
	messages: ClaudeMessage[],
	updateState: (updates: Partial<ChatState>) => void,
	setAttachments: (attachments: Resource[]) => void
) => {
	const pendingUpdatesRef = useRef<Partial<ChatState>>({})
	const timeoutRef = useRef<NodeJS.Timeout>()
	const lastHandledMessageRef = useRef<{ ts: number; type: string }>()

	// Batch state updates
	const batchUpdateState = useCallback(
		(updates: Partial<ChatState>) => {
			pendingUpdatesRef.current = { ...pendingUpdatesRef.current, ...updates }

			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current)
			}

			timeoutRef.current = setTimeout(() => {
				updateState(pendingUpdatesRef.current)
				pendingUpdatesRef.current = {}
			}, 0)
		},
		[updateState]
	)

	// Cleanup timeout on unmount
	useEffect(() => {
		return () => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current)
			}
		}
	}, [])

	const handleMessage = useCallback(
		(event: MessageEvent) => {
			const message: ExtensionMessage = event.data
			if (message.type === "enableTextAreas") {
				batchUpdateState({
					textAreaDisabled: false,
					claudeAsk: undefined,
					enableButtons: false,
					primaryButtonText: undefined,
					secondaryButtonText: undefined,
				})
			}
		},
		[batchUpdateState]
	)

	useEvent("message", handleMessage)

	const handleAskMessage = useCallback(
		(message: ClaudeMessage) => {
			if (!isV1ClaudeMessage(message)) return

			const toolStateMap: Record<string, Partial<ChatState>> = {
				request_limit_reached: {
					textAreaDisabled: true,
					claudeAsk: "request_limit_reached",
					enableButtons: true,
					primaryButtonText: "Proceed",
					secondaryButtonText: "Start New Task",
				},
				api_req_failed: {
					textAreaDisabled: false,
					claudeAsk: "api_req_failed",
					...(message.autoApproved
						? {}
						: {
								enableButtons: true,
								primaryButtonText: "Retry",
								secondaryButtonText: "Start New Task",
						  }),
				},
				followup: {
					enableButtons: false,
					primaryButtonText: undefined,
					secondaryButtonText: undefined,
					textAreaDisabled: false,
					claudeAsk: "followup",
				},
				command: {
					textAreaDisabled: false,
					claudeAsk: "command",
					...(message.autoApproved
						? {}
						: {
								enableButtons: true,
								primaryButtonText: "Run Command",
								secondaryButtonText: "Reject",
						  }),
				},
				command_output: {
					textAreaDisabled: false,
					claudeAsk: "command_output",
					...(message.autoApproved
						? {}
						: {
								enableButtons: true,
								primaryButtonText: "Exit Command",
								secondaryButtonText: undefined,
						  }),
				},
				completion_result: {
					textAreaDisabled: false,
					claudeAsk: "completion_result",
					enableButtons: true,
					primaryButtonText: "Start New Task",
					secondaryButtonText: undefined,
				},
				resume_completed_task: {
					textAreaDisabled: false,
					claudeAsk: "resume_completed_task",
					enableButtons: true,
					primaryButtonText: "Start New Task",
					secondaryButtonText: undefined,
				},
				resume_task: {
					textAreaDisabled: false,
					claudeAsk: "resume_task",
					enableButtons: true,
					primaryButtonText: "Resume Task",
					secondaryButtonText: undefined,
				},
			}

			if (message.ask === "tool") {
				const tool = JSON.parse(message.text || "{}") as ChatTool
				const baseState = {
					textAreaDisabled: tool.approvalState === "pending" ? false : true,
					claudeAsk: "tool",
					enableButtons: tool.approvalState === "pending" ? true : false,
				}

				if (tool.approvalState !== "pending" && tool.tool !== "attempt_completion") {
					batchUpdateState({
						...baseState,
						enableButtons: false,
						primaryButtonText: undefined,
						secondaryButtonText: undefined,
					})
					lastHandledMessageRef.current = { ts: message.ts, type: "ask" }
					return
				}
				if (tool.approvalState !== "pending") {
					return
				}

				const toolButtonMap: Record<ChatTool["tool"], Partial<ChatState>> = {
					attempt_completion: {
						...baseState,
						claudeAsk: "completion_result",
						primaryButtonText: "Start New Task",
						secondaryButtonText: undefined,
						textAreaDisabled: false,
						enableButtons: true,
					},
					write_to_file: {
						...baseState,
						primaryButtonText: "Save",
						secondaryButtonText: "Cancel",
					},
					execute_command: {
						...baseState,
						primaryButtonText: "Run Command",
						secondaryButtonText: "Cancel",
					},
					ask_followup_question: {
						...baseState,
						textAreaDisabled: false,
						enableButtons: false,
						primaryButtonText: undefined,
						secondaryButtonText: undefined,
					},
					read_file: {
						...baseState,
						primaryButtonText: "Read File",
						secondaryButtonText: "Cancel",
					},
					list_files: {
						...baseState,
						primaryButtonText: "List Files",
						secondaryButtonText: "Cancel",
					},
					url_screenshot: {
						...baseState,
						primaryButtonText: "Take Screenshot",
						secondaryButtonText: "Cancel",
					},
					search_files: {
						...baseState,
						primaryButtonText: "Search Files",
						secondaryButtonText: "Cancel",
					},
					server_runner_tool: {
						...baseState,
						primaryButtonText: "Run Server",
						secondaryButtonText: "Cancel",
					},
					web_search: {
						...baseState,
						primaryButtonText: "Search",
						secondaryButtonText: "Cancel",
					},
					ask_consultant: {
						...baseState,
						primaryButtonText: "Ask Consultant",
						secondaryButtonText: "Cancel",
					},
					list_code_definition_names: {
						...baseState,
						primaryButtonText: "List Definitions",
						secondaryButtonText: "Cancel",
					},
				}

				const updates = toolButtonMap[tool.tool] || {
					...baseState,
					primaryButtonText: "Proceed",
					secondaryButtonText: "Cancel",
				}

				batchUpdateState(updates)
			} else {
				const updates = toolStateMap[message.ask ?? ""]
				if (updates) {
					batchUpdateState(updates)
				}
			}
		},
		[batchUpdateState]
	)

	const handleSayMessage = useCallback(
		(message: ClaudeMessage) => {
			const sayStateMap: Record<string, Partial<ChatState>> = {
				abort_automode: {
					textAreaDisabled: false,
					claudeAsk: undefined,
					enableButtons: false,
					primaryButtonText: undefined,
					secondaryButtonText: undefined,
				},
				api_req_started: {
					inputValue: "",
					isAbortingRequest: false,
					textAreaDisabled: true,
					selectedImages: [],
					claudeAsk: undefined,
					enableButtons: false,
				},
				error: {
					isAbortingRequest: false,
					textAreaDisabled: false,
					claudeAsk: undefined,
					enableButtons: false,
					primaryButtonText: undefined,
					secondaryButtonText: undefined,
				},
			}

			const updates = sayStateMap[message.say!]
			if (updates) {
				batchUpdateState(updates)
			}

			lastHandledMessageRef.current = { ts: message.ts, type: "say" }
		},
		[batchUpdateState]
	)

	useEffect(() => {
		const msgs = messages.slice().reverse()
		const lastMessage = msgs[0]
		const lastAskMessage = msgs.find((msg) => msg.type === "ask")
		const secondToLastAskMessage = msgs.find((msg) => msg.ask === "tool" && msg.ts !== lastAskMessage?.ts)

		// Special case: execute_command after attempt_completion
		if (lastAskMessage?.ask === "tool" && secondToLastAskMessage?.ask === "tool" && !lastMessage.say) {
			const lastTool = JSON.parse(lastAskMessage.text || "{}") as ChatTool
			const secondToLastTool = JSON.parse(secondToLastAskMessage.text || "{}") as ChatTool

			if (lastTool.tool === "execute_command" && secondToLastTool.tool === "attempt_completion") {
				const updates =
					lastTool.approvalState === "pending"
						? {
								textAreaDisabled: false,
								claudeAsk: "command",
								enableButtons: true,
								primaryButtonText: "Run Command",
								secondaryButtonText: "Cancel",
						  }
						: {
								textAreaDisabled: false,
								claudeAsk: "completion_result",
								enableButtons: true,
								primaryButtonText: "Start New Task",
								secondaryButtonText: undefined,
						  }
				batchUpdateState(updates)
				lastHandledMessageRef.current = { ts: lastAskMessage.ts, type: "ask" }
				return
			}
		}

		// Skip if message already handled
		// if (lastMessage && handledTs.includes(lastMessage.ts)) {
		// 	return
		// }

		// Handle messages based on type and recency
		if (lastMessage?.say === "error" || lastMessage?.say === "api_req_started") {
			handleSayMessage(lastMessage)
		} else if (lastAskMessage) {
			handleAskMessage(lastAskMessage)
		} else if (!lastMessage && !lastAskMessage) {
			batchUpdateState({
				textAreaDisabled: false,
				claudeAsk: undefined,
				enableButtons: false,
				primaryButtonText: undefined,
				secondaryButtonText: undefined,
			})
			setAttachments([])
		}
	}, [messages])

	return { handleAskMessage, handleSayMessage }
}
