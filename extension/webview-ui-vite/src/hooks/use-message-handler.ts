import { ChatState } from "@/components/chat-view/chat"
import { useCallback, useEffect } from "react"
import { ClaudeMessage, isV1ClaudeMessage } from "../../../src/shared/ExtensionMessage"
import { ChatTool } from "../../../src/shared/new-tools"
import { Resource } from "../../../src/shared/WebviewMessage"

export const useChatMessageHandling = (
	messages: ClaudeMessage[],
	updateState: (updates: Partial<ChatState>) => void,
	setAttachments: (attachments: Resource[]) => void
) => {
	const handleAskMessage = useCallback(
		(message: ClaudeMessage) => {
			if (!isV1ClaudeMessage(message)) return
			switch (message.ask) {
				case "request_limit_reached":
					updateState({
						textAreaDisabled: true,
						claudeAsk: "request_limit_reached",
						enableButtons: true,
						primaryButtonText: "Proceed",
						secondaryButtonText: "Start New Task",
					})
					break

				case "api_req_failed":
					updateState({
						textAreaDisabled: true,
						claudeAsk: "api_req_failed",
						...(message.autoApproved
							? {}
							: {
									enableButtons: true,
									primaryButtonText: "Retry",
									secondaryButtonText: "Start New Task",
							  }),
					})
					break

				case "followup":
					updateState({
						enableButtons: false,
						primaryButtonText: undefined,
						secondaryButtonText: undefined,
						textAreaDisabled: false,
						claudeAsk: "followup",
					})
					break

				case "tool": {
					const tool = JSON.parse(message.text || "{}") as ChatTool
					const baseState = {
						textAreaDisabled: tool.approvalState === "pending" ? false : true,
						claudeAsk: "tool",
						enableButtons: true,
					}

					if (tool.approvalState !== "pending" && tool.tool !== "attempt_completion") {
						updateState({
							...baseState,
							enableButtons: false,
							primaryButtonText: undefined,
							secondaryButtonText: undefined,
						})
						return
					}

					switch (tool?.tool) {
						case "attempt_completion":
							updateState({
								...baseState,
								claudeAsk: "completion_result",
								primaryButtonText: "Start New Task",
								secondaryButtonText: undefined,
								textAreaDisabled: false,
								enableButtons: true,
							})
							break

						case "write_to_file":
							updateState({
								...baseState,
								primaryButtonText: "Save",
								secondaryButtonText: "Cancel",
							})
							break

						case "execute_command":
							updateState({
								...baseState,
								primaryButtonText: "Run Command",
								secondaryButtonText: "Cancel",
							})
							break

						case "ask_followup_question":
							updateState({
								...baseState,
								primaryButtonText: "Send",
								secondaryButtonText: "Cancel",
							})
							break

						case "read_file":
							updateState({
								...baseState,
								primaryButtonText: "Read File",
								secondaryButtonText: "Cancel",
							})
							break

						case "list_files":
							updateState({
								...baseState,
								primaryButtonText: "List Files",
								secondaryButtonText: "Cancel",
							})
							break

						case "url_screenshot":
							updateState({
								...baseState,
								primaryButtonText: "Take Screenshot",
								secondaryButtonText: "Cancel",
							})
							break

						case "search_files":
							updateState({
								...baseState,
								primaryButtonText: "Search Files",
								secondaryButtonText: "Cancel",
							})
							break

						case "server_runner_tool":
							updateState({
								...baseState,
								primaryButtonText: "Run Server",
								secondaryButtonText: "Cancel",
							})
							break

						case "web_search":
							updateState({
								...baseState,
								primaryButtonText: "Search",
								secondaryButtonText: "Cancel",
							})
							break

						case "ask_consultant":
							updateState({
								...baseState,
								primaryButtonText: "Ask Consultant",
								secondaryButtonText: "Cancel",
							})
							break

						case "list_code_definition_names":
							updateState({
								...baseState,
								primaryButtonText: "List Definitions",
								secondaryButtonText: "Cancel",
							})
							break

						default:
							updateState({
								...baseState,
								primaryButtonText: "Proceed",
								secondaryButtonText: "Cancel",
							})
							break
					}
					break
				}

				case "command":
					updateState({
						textAreaDisabled: false,
						claudeAsk: "command",
						...(message.autoApproved
							? {}
							: {
									enableButtons: true,
									primaryButtonText: "Run Command",
									secondaryButtonText: "Reject",
							  }),
					})
					break

				case "command_output":
					updateState({
						textAreaDisabled: false,
						claudeAsk: "command_output",
						...(message.autoApproved
							? {}
							: {
									enableButtons: true,
									primaryButtonText: "Exit Command",
									secondaryButtonText: undefined,
							  }),
					})
					break

				case "completion_result":
				case "resume_completed_task":
					updateState({
						textAreaDisabled: false,
						claudeAsk: message.ask,
						enableButtons: true,
						primaryButtonText: "Start New Task",
						secondaryButtonText: undefined,
					})
					break

				case "resume_task":
					updateState({
						textAreaDisabled: false,
						claudeAsk: "resume_task",
						enableButtons: true,
						primaryButtonText: "Resume Task",
						secondaryButtonText: undefined,
					})
					break
			}
		},
		[updateState]
	)

	const handleSayMessage = useCallback(
		(message: ClaudeMessage) => {
			switch (message.say) {
				case "text":
					updateState({
						textAreaDisabled: false,
						claudeAsk: undefined,
						primaryButtonText: undefined,
						secondaryButtonText: undefined,
						enableButtons: false,
					})
					break

				case "abort_automode":
					updateState({
						textAreaDisabled: false,
						claudeAsk: undefined,
						enableButtons: false,
						primaryButtonText: undefined,
						secondaryButtonText: undefined,
					})
					break

				case "api_req_started":
					if (messages.at(-2)?.ask === "command_output") {
						updateState({
							inputValue: "",
							textAreaDisabled: true,
							selectedImages: [],
							claudeAsk: undefined,
							enableButtons: false,
						})
					}
					break

				case "error":
					updateState({
						isAbortingRequest: false,
						textAreaDisabled: false,
						claudeAsk: undefined,
						enableButtons: false,
						primaryButtonText: undefined,
						secondaryButtonText: undefined,
					})
					break
			}
		},
		[messages, updateState]
	)

	useEffect(() => {
		const lastMessage = messages.at(-1)
		if (lastMessage) {
			if (lastMessage.type === "ask") handleAskMessage(lastMessage)
			else if (lastMessage.type === "say") handleSayMessage(lastMessage)
		} else {
			updateState({
				textAreaDisabled: false,
				claudeAsk: undefined,
				enableButtons: false,
				primaryButtonText: undefined,
				secondaryButtonText: undefined,
			})
			setAttachments([])
		}
	}, [messages, handleAskMessage, handleSayMessage, updateState, setAttachments])

	return { handleAskMessage, handleSayMessage }
}
