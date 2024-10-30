import { ChatState } from "@/components/chat-view/chat"
import { useCallback, useEffect, useRef } from "react"
import { ClaudeMessage, ExtensionMessage, isV1ClaudeMessage } from "../../../src/shared/ExtensionMessage"
import { ChatTool } from "../../../src/shared/new-tools"
import { Resource } from "../../../src/shared/WebviewMessage"
import { useEvent } from "react-use"

type MessageState = {
	type: "idle" | "processing" | "ask" | "say" | "tool" | "error"
	data?: any
}

type StateUpdate = {
	state: Partial<ChatState>
	priority: number
}

export const useChatMessageHandling = (
	messages: ClaudeMessage[],
	updateState: (updates: Partial<ChatState>) => void,
	setAttachments: (attachments: Resource[]) => void
) => {
	// Message queue for handling concurrent updates
	const messageQueueRef = useRef<StateUpdate[]>([])
	const processingRef = useRef(false)
	const currentStateRef = useRef<MessageState>({ type: "idle" })

	// Process queued state updates in order of priority
	const processQueue = useCallback(() => {
		if (processingRef.current || messageQueueRef.current.length === 0) return

		processingRef.current = true
		const updates = messageQueueRef.current
			.sort((a, b) => b.priority - a.priority)
			.reduce((acc, curr) => ({ ...acc, ...curr.state }), {})

		messageQueueRef.current = []
		updateState(updates)
		processingRef.current = false
	}, [updateState])

	// Queue state update with priority
	const queueStateUpdate = useCallback(
		(update: Partial<ChatState>, priority: number) => {
			messageQueueRef.current.push({ state: update, priority })
			processQueue()
		},
		[processQueue]
	)

	// Handle state transitions
	const transition = useCallback(
		(newState: MessageState, updates: Partial<ChatState>) => {
			const validTransitions: Record<string, string[]> = {
				idle: ["processing", "ask", "say", "tool"],
				processing: ["idle", "error", "ask", "say", "tool"],
				ask: ["processing", "idle", "error"],
				say: ["processing", "idle", "error"],
				tool: ["processing", "idle", "error"],
				error: ["idle"],
			}

			if (!validTransitions[currentStateRef.current.type].includes(newState.type)) {
				console.warn(`Invalid state transition: ${currentStateRef.current.type} -> ${newState.type}`)
				return
			}

			currentStateRef.current = newState
			queueStateUpdate(updates, getStatePriority(newState.type))
		},
		[queueStateUpdate]
	)

	// Get priority for different state types
	const getStatePriority = (stateType: string): number => {
		const priorities: Record<string, number> = {
			error: 5,
			tool: 4,
			ask: 3,
			say: 2,
			processing: 1,
			idle: 0,
		}
		return priorities[stateType] ?? 0
	}

	// Handle extension messages
	const handleMessage = useCallback(
		(event: MessageEvent) => {
			const message: ExtensionMessage = event.data
			if (message.type === "enableTextAreas") {
				transition(
					{ type: "idle" },
					{
						textAreaDisabled: false,
						claudeAsk: undefined,
						enableButtons: false,
						primaryButtonText: undefined,
						secondaryButtonText: undefined,
					}
				)
			}
		},
		[transition]
	)

	useEvent("message", handleMessage)

	// Handle ask messages
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
					transition(
						{ type: "tool", data: tool },
						{
							...baseState,
							enableButtons: false,
							primaryButtonText: undefined,
							secondaryButtonText: undefined,
						}
					)
					return
				}

				if (tool.approvalState !== "pending") return

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

				transition({ type: "tool", data: tool }, updates)
			} else {
				const updates = toolStateMap[message.ask ?? ""]
				if (updates) {
					transition({ type: "ask", data: message.ask }, updates)
				}
			}
		},
		[transition]
	)

	// Handle say messages
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
				transition({ type: "say", data: message.say }, updates)
			}
		},
		[transition]
	)

	// Handle message updates
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

				transition({ type: "tool", data: { lastTool, secondToLastTool } }, updates)
				return
			}
		}

		// Handle messages based on type
		if (lastMessage?.say === "error" || lastMessage?.say === "api_req_started") {
			handleSayMessage(lastMessage)
		} else if (lastAskMessage) {
			handleAskMessage(lastAskMessage)
		} else if (!lastMessage && !lastAskMessage) {
			transition(
				{ type: "idle" },
				{
					textAreaDisabled: false,
					claudeAsk: undefined,
					enableButtons: false,
					primaryButtonText: undefined,
					secondaryButtonText: undefined,
				}
			)
			setAttachments([])
		}
	}, [messages, handleAskMessage, handleSayMessage, transition, setAttachments])

	return { handleAskMessage, handleSayMessage }
}
