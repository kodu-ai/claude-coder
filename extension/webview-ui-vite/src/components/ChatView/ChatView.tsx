import { VSCodeLink } from "@vscode/webview-ui-toolkit/react"
import { atom, useAtom } from "jotai"
import React, { KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react"
import vsDarkPlus from "react-syntax-highlighter/dist/esm/styles/prism/vsc-dark-plus"
import { useEvent, useMount } from "react-use"
import { VirtuosoHandle } from "react-virtuoso"
import {
	ClaudeAsk,
	ClaudeMessage,
	ClaudeSayTool,
	ExtensionMessage,
	V1ClaudeMessage,
	isV1ClaudeMessage,
} from "../../../../src/shared/ExtensionMessage"
import { combineApiRequests } from "../../../../src/shared/combineApiRequests"
import { COMMAND_STDIN_STRING, combineCommandSequences } from "../../../../src/shared/combineCommandSequences"
import { getApiMetrics } from "../../../../src/shared/getApiMetrics"
import { useExtensionState } from "../../context/ExtensionStateContext"
import { getSyntaxHighlighterStyleFromTheme } from "../../utils/getSyntaxHighlighterStyleFromTheme"
import { vscode } from "../../utils/vscode"
import Announcement from "../Announcement/Announcement"
import HistoryPreview from "../HistoryPreview/HistoryPreview"
import KoduPromo from "../KoduPromo/KoduPromo"
import TaskHeader from "../TaskHeader/TaskHeader"
import ProjectStarterChooser from "../project-starters"
import ButtonSection from "./ButtonSection"
import ChatMessages from "./ChatMessages"
import InputArea from "./InputArea"
import { CHAT_BOX_INPUT_ID } from "./InputTextArea"
import ChatScreen from "./chat-screen"
import { Resource } from "../../../../src/shared/WebviewMessage"
import { useOutOfCreditDialog } from "../dialogs/out-of-credit-dialog"
import { ChatTool } from "../../../../src/shared/new-tools"

export const attachementsAtom = atom<Resource[]>([])

interface ChatViewProps {
	isHidden: boolean
	showAnnouncement: boolean
	selectedModelSupportsImages: boolean
	selectedModelSupportsPromptCache: boolean
	hideAnnouncement: () => void
	showHistoryView: () => void
}

const MAX_IMAGES_PER_MESSAGE = 5

const ChatView: React.FC<ChatViewProps> = ({
	isHidden,
	showAnnouncement,
	selectedModelSupportsImages,
	selectedModelSupportsPromptCache,
	hideAnnouncement,
	showHistoryView,
}) => {
	const {
		version,
		claudeMessages: messages,
		taskHistory,
		themeName: vscodeThemeName,
		uriScheme,
		shouldShowKoduPromo,
		user,
	} = useExtensionState()

	// Input-related state
	const [inputValue, setInputValue] = useState("")
	const [textAreaDisabled, setTextAreaDisabled] = useState(false)
	const [selectedImages, setSelectedImages] = useState<string[]>([])
	const [thumbnailsHeight, setThumbnailsHeight] = useState(0)
	const { openOutOfCreditDialog, shouldOpenOutOfCreditDialog } = useOutOfCreditDialog()
	// UI control state
	const [claudeAsk, setClaudeAsk] = useState<ClaudeAsk | undefined>(undefined)
	const [_, setIsAbortingRequest] = useState(false)
	const [enableButtons, setEnableButtons] = useState<boolean>(false)
	const [primaryButtonText, setPrimaryButtonText] = useState<string | undefined>(undefined)
	const [secondaryButtonText, setSecondaryButtonText] = useState<string | undefined>(undefined)
	const [syntaxHighlighterStyle, setSyntaxHighlighterStyle] = useState(vsDarkPlus)
	const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({})
	const [attachements, setAttachements] = useAtom(attachementsAtom)

	// Refs
	const textAreaRef = useRef<HTMLTextAreaElement>(null)
	const virtuosoRef = useRef<VirtuosoHandle>(null)

	// isMessageRunning
	const isMessageRunning = useMemo(() => {
		const lastMessage = messages.at(-1)
		if (lastMessage && isV1ClaudeMessage(lastMessage)) {
			// find last say with api_req_started
			const lastSay = messages
				.slice()
				.reverse()
				.find((message) => message.type === "say" && message.say === "api_req_started") as
				| V1ClaudeMessage
				| undefined
			if (lastSay && lastSay.isFetching) {
				return true
			}
			return false
		}
		if (lastMessage && lastMessage.type === "say" && lastMessage.say === "api_req_started") {
			return true
		}
		return false
	}, [messages])

	// Memoized values
	const task = useMemo(() => (messages.length > 0 ? messages[0] : undefined), [messages])
	const modifiedMessages = useMemo(() => combineApiRequests(combineCommandSequences(messages.slice(1))), [messages])
	const apiMetrics = useMemo(() => getApiMetrics(modifiedMessages), [modifiedMessages])
	const selectImages = () => {
		vscode.postMessage({ type: "selectImages" })
	}
	// Update syntax highlighter style when theme changes
	useEffect(() => {
		if (!vscodeThemeName) return
		const theme = getSyntaxHighlighterStyleFromTheme(vscodeThemeName)
		if (theme) {
			setSyntaxHighlighterStyle(theme)
		}
	}, [vscodeThemeName])

	// handle keyDown
	const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
		const isComposing = event.nativeEvent?.isComposing ?? false
		if (event.key === "Enter" && !event.shiftKey && !isComposing) {
			event.preventDefault()
			handleSendMessage()
		}
	}

	// Handle changes in messages
	useEffect(() => {
		const lastMessage = messages.at(-1)
		if (lastMessage) {
			switch (lastMessage.type) {
				case "ask":
					console.log(`last message is ask ${lastMessage.ask}`)
					handleAskMessage(lastMessage)
					break
				case "say":
					console.log(`last message is say ${lastMessage.say}`)
					handleSayMessage(lastMessage)
					break
			}
		} else {
			setAttachements([])
			setTextAreaDisabled(false)
			setClaudeAsk(undefined)
			setEnableButtons(false)
			setPrimaryButtonText(undefined)
			setSecondaryButtonText(undefined)
		}
	}, [messages])

	// Filter visible messages
	const visibleMessages = useMemo(() => {
		return modifiedMessages.filter((message) => {
			if (
				(message.ask === "completion_result" && message.text === "") ||
				["resume_task", "resume_completed_task"].includes(message.ask!)
			) {
				return false
			}
			if (["api_req_finished", "api_req_retried"].includes(message.say!)) {
				return false
			}
			if (message.say === "api_req_started") return true
			if (message.say === "text" && (message.text ?? "") === "" && (message.images?.length ?? 0) === 0) {
				return false
			}
			return true
		})
	}, [modifiedMessages])

	// Focus textarea when component becomes visible
	useEffect(() => {
		const timer = setTimeout(() => {
			if (!isHidden && !textAreaDisabled && !enableButtons) {
				textAreaRef.current?.focus()
			}
		}, 50)
		return () => clearTimeout(timer)
	}, [isHidden, textAreaDisabled, enableButtons])

	// Scroll to bottom when messages change
	useEffect(() => {
		const timer = setTimeout(() => {
			virtuosoRef.current?.scrollTo({ top: Number.MAX_SAFE_INTEGER, behavior: "smooth" })
		}, 50)
		return () => clearTimeout(timer)
	}, [visibleMessages])

	// Handle sending messages
	const handleSendMessage = useCallback(
		(input?: string) => {
			if (shouldOpenOutOfCreditDialog) {
				openOutOfCreditDialog()
				return
			}
			console.log(`inputValue: ${inputValue}`)
			let text = inputValue?.trim()
			if (!!input && input.length > 1) {
				text = input?.trim()
			}
			if (text || selectedImages.length > 0) {
				if (messages.length === 0) {
					vscode.postMessage({ type: "newTask", text, images: selectedImages, attachements: attachements })
				} else if (claudeAsk) {
					handleClaudeAskResponse(text)
				} else {
					vscode.postMessage({
						type: "askResponse",
						askResponse: "messageResponse",
						text,
						images: selectedImages,
						attachements: attachements,
					})
				}
				setAttachements([])
				setInputValue("")
				setTextAreaDisabled(true)
				setSelectedImages([])
				setClaudeAsk(undefined)
				setEnableButtons(false)
			}
		},
		[inputValue, selectedImages, messages.length, claudeAsk, user, shouldOpenOutOfCreditDialog]
	)

	// Handle Claude ask response
	const handleClaudeAskResponse = useCallback(
		(text: string) => {
			if (claudeAsk) {
				vscode.postMessage({
					type: "askResponse",
					askResponse: "messageResponse",
					text,
					images: selectedImages,
				})
			}
		},
		[claudeAsk, selectedImages]
	)

	// Handle paste

	const handlePaste = async (e: React.ClipboardEvent) => {
		if (shouldDisableImages) {
			e.preventDefault()
			return
		}

		const items = e.clipboardData.items
		const acceptedTypes = ["png", "jpeg", "webp"] // supported by anthropic and openrouter (jpg is just a file extension but the image will be recognized as jpeg)
		const imageItems = Array.from(items).filter((item) => {
			const [type, subtype] = item.type.split("/")
			return type === "image" && acceptedTypes.includes(subtype)
		})
		if (imageItems.length > 0) {
			e.preventDefault()
			const imagePromises = imageItems.map((item) => {
				return new Promise<string | null>((resolve) => {
					const blob = item.getAsFile()
					if (!blob) {
						resolve(null)
						return
					}
					const reader = new FileReader()
					reader.onloadend = () => {
						if (reader.error) {
							console.error("Error reading file:", reader.error)
							resolve(null)
						} else {
							const result = reader.result
							resolve(typeof result === "string" ? result : null)
						}
					}
					reader.readAsDataURL(blob)
				})
			})
			const imageDataArray = await Promise.all(imagePromises)
			const dataUrls = imageDataArray.filter((dataUrl): dataUrl is string => dataUrl !== null)
			//.map((dataUrl) => dataUrl.split(",")[1]) // strip the mime type prefix, sharp doesn't need it
			if (dataUrls.length > 0) {
				setSelectedImages((prevImages) => [...prevImages, ...dataUrls].slice(0, MAX_IMAGES_PER_MESSAGE))
			} else {
				console.warn("No valid images were processed")
			}
		}
	}

	// Handle primary button click
	const handlePrimaryButtonClick = useCallback(() => {
		switch (claudeAsk) {
			case "api_req_failed":
			case "request_limit_reached":
			case "command":
			case "command_output":
			case "tool":
			case "resume_task":
				if (shouldOpenOutOfCreditDialog) {
					openOutOfCreditDialog()
					return
				}
				vscode.postMessage({ type: "askResponse", askResponse: "yesButtonTapped" })
				break
			case "completion_result":
			case "resume_completed_task":
				vscode.postMessage({ type: "clearTask" })
				break
		}
		setTextAreaDisabled(true)
		setClaudeAsk(undefined)
		setEnableButtons(false)
	}, [claudeAsk, shouldOpenOutOfCreditDialog])

	// Handle secondary button click
	const handleSecondaryButtonClick = useCallback(() => {
		switch (claudeAsk) {
			case "request_limit_reached":
			case "api_req_failed":
				vscode.postMessage({ type: "clearTask" })
				break
			case "command":
			case "tool":
				vscode.postMessage({ type: "askResponse", askResponse: "noButtonTapped" })
				break
		}
		setTextAreaDisabled(true)
		setClaudeAsk(undefined)
		setEnableButtons(false)
	}, [claudeAsk])

	// Handle incoming messages
	const handleMessage = useCallback(
		(e: MessageEvent) => {
			const message: ExtensionMessage = e.data
			switch (message.type) {
				case "action":
					if (message.action === "didBecomeVisible") {
						if (!isHidden && !textAreaDisabled && !enableButtons) {
							textAreaRef.current?.focus()
						}
					}
					break
				case "selectedImages":
					const newImages = message.images ?? []
					if (newImages.length > 0) {
						setSelectedImages((prevImages) =>
							[...prevImages, ...newImages].slice(0, MAX_IMAGES_PER_MESSAGE)
						)
					}
					break
			}
		},
		[isHidden, textAreaDisabled, enableButtons]
	)

	useEvent("message", handleMessage)

	useMount(() => {
		textAreaRef.current?.focus()
	})

	const isAbortAllowed = messages.length > 2 && messages.at(-1)?.say === "api_req_started"

	// Handle ask messages
	const handleAskMessage = (message: ClaudeMessage) => {
		// This function updates the component state based on the type of ask message received
		switch (message.ask) {
			case "request_limit_reached":
				setTextAreaDisabled(true)
				setClaudeAsk("request_limit_reached")

				setEnableButtons(true)
				setPrimaryButtonText("Proceed")
				setSecondaryButtonText("Start New Task")
				break
			case "api_req_failed":
				setTextAreaDisabled(true)
				setClaudeAsk("api_req_failed")
				if (!message.autoApproved) {
					setEnableButtons(true)
					setPrimaryButtonText("Retry")
					setSecondaryButtonText("Start New Task")
				}
				break
			case "followup":
				console.log("followup")
				setEnableButtons(false)
				setPrimaryButtonText("")
				setSecondaryButtonText("")
				setTextAreaDisabled(false)
				setClaudeAsk("followup")
				break
			case "tool":
				setTextAreaDisabled(false)
				setClaudeAsk("tool")
				if (!message.autoApproved) {
					setEnableButtons(true)
					const tool = JSON.parse(message.text || "{}") as ChatTool
					switch (tool?.tool) {
						case "write_to_file":
							setPrimaryButtonText("Save")
							setSecondaryButtonText("Reject")
							break
						case "web_search":
							setPrimaryButtonText("Search")
							setSecondaryButtonText("Reject")
							break
						case "attempt_completion":
							// we want to update the type of button executed based on the tool
							setClaudeAsk("completion_result")
							setPrimaryButtonText("Start New Task")
							setSecondaryButtonText(undefined)
							break
						case "ask_followup_question":
							setPrimaryButtonText(undefined)
							setSecondaryButtonText(undefined)
							setEnableButtons(false)
							break
						case "url_screenshot":
							setPrimaryButtonText("Capture Screenshot")
							setSecondaryButtonText("Reject")
							break
						case "ask_consultant":
							setPrimaryButtonText("Ask Consultant")
							setSecondaryButtonText("Reject")
							break
						case "execute_command":
							setPrimaryButtonText("Run Command")
							setSecondaryButtonText("Reject")
							break
						case "upsert_memory":
							setPrimaryButtonText(undefined)
							setSecondaryButtonText(undefined)
							setEnableButtons(false)
							break
						case "list_files":
						case "list_code_definition_names":
						case "search_files":
						case "read_file":
							setPrimaryButtonText("Read")
							setSecondaryButtonText("Reject")
							break
						default:
							handleToolButtons(tool)
					}
				}
				break
			case "command":
				setTextAreaDisabled(false)
				setClaudeAsk("command")
				if (!message.autoApproved) {
					setEnableButtons(true)
					setPrimaryButtonText("Run Command")
					setSecondaryButtonText("Reject")
				}
				break
			case "command_output":
				setTextAreaDisabled(false)
				setClaudeAsk("command_output")
				if (!message.autoApproved) {
					setEnableButtons(true)
					setPrimaryButtonText("Exit Command")
					setSecondaryButtonText(undefined)
				}

				break
			case "completion_result":
			case "resume_completed_task":
				setTextAreaDisabled(false)
				setClaudeAsk(message.ask)
				setEnableButtons(true)
				setPrimaryButtonText("Start New Task")
				setSecondaryButtonText(undefined)
				break
			case "resume_task":
				setTextAreaDisabled(false)
				setClaudeAsk("resume_task")
				setEnableButtons(true)
				setPrimaryButtonText("Resume Task")
				setSecondaryButtonText(undefined)
				break
		}
	}

	// Handle say messages
	const handleSayMessage = (message: ClaudeMessage) => {
		// This function updates the component state based on the type of say message received
		switch (message.say) {
			case "text":
				setTextAreaDisabled(false)
				setClaudeAsk(undefined)
				// removes the button text if the message is say
				setPrimaryButtonText(undefined)
				setSecondaryButtonText(undefined)
				setEnableButtons(false)
				break
			case "abort_automode":
				setTextAreaDisabled(false)
				setClaudeAsk(undefined)
				setEnableButtons(false)
				setPrimaryButtonText(undefined)
				setSecondaryButtonText(undefined)
				break
			case "api_req_started":
				if (messages.at(-2)?.ask === "command_output") {
					setInputValue("")
					setTextAreaDisabled(true)
					setSelectedImages([])
					setClaudeAsk(undefined)
					setEnableButtons(false)
				}
				break
			case "error":
				setIsAbortingRequest(false)
				setTextAreaDisabled(false)
				setClaudeAsk(undefined)
				setEnableButtons(false)
				setPrimaryButtonText(undefined)
				setSecondaryButtonText(undefined)
				break
		}
	}

	// Handle tool buttons
	const handleToolButtons = (tool: ClaudeSayTool) => {
		switch (tool.tool) {
			case "editedExistingFile":
				setPrimaryButtonText("Save")
				setSecondaryButtonText("Reject")
				break
			case "newFileCreated":
				setPrimaryButtonText("Create")
				setSecondaryButtonText("Reject")
				break
			default:
				setPrimaryButtonText("Approve")
				setSecondaryButtonText("Reject")
				break
		}
	}

	// Toggle row expansion
	const toggleRowExpansion = useCallback((ts: number) => {
		setExpandedRows((prev) => ({
			...prev,
			[ts]: !prev[ts],
		}))
	}, [])

	// Set placeholder text
	const placeholderText = useMemo(() => {
		return task ? "Type a message..." : "Type your task here..."
	}, [task])

	// Check if a request is running

	// Determine if abort automode should be shown

	// Determine if images should be disabled
	const shouldDisableImages =
		!selectedModelSupportsImages || textAreaDisabled || selectedImages.length >= MAX_IMAGES_PER_MESSAGE

	// Thumbnail height change handler
	useEffect(() => {
		if (selectedImages.length === 0) {
			setThumbnailsHeight(0)
		}
	}, [selectedImages])

	const handleThumbnailsHeightChange = useCallback((height: number) => {
		setThumbnailsHeight(height)
	}, [])

	// Memoize the handleSendStdin function
	const handleSendStdin = useCallback(
		(text: string) => {
			if (claudeAsk === "command_output") {
				vscode.postMessage({
					type: "askResponse",
					askResponse: "messageResponse",
					text: COMMAND_STDIN_STRING + text,
				})
				setClaudeAsk(undefined)
			}
		},
		[claudeAsk]
	)

	return (
		<div
			style={{
				position: "fixed",
				top: 0,
				left: 0,
				right: 0,
				bottom: 0,
				display: isHidden ? "none" : "flex",
				flexDirection: "column",
				overflow: "hidden",
			}}>
			<div
				style={{
					borderTop: "1px solid var(--section-border)",
					flex: "1 1 0%",
					display: "flex",
					flexDirection: "column",
					overflowY: "auto",
				}}>
				{task ? (
					<TaskHeader
						task={task}
						tokensIn={apiMetrics.totalTokensIn}
						tokensOut={apiMetrics.totalTokensOut}
						doesModelSupportPromptCache={selectedModelSupportsPromptCache}
						cacheWrites={apiMetrics.totalCacheWrites}
						cacheReads={apiMetrics.totalCacheReads}
						totalCost={apiMetrics.totalCost}
						onClose={() => vscode.postMessage({ type: "clearTask" })}
						isHidden={isHidden}
						koduCredits={user?.credits ?? 0}
						vscodeUriScheme={uriScheme}
					/>
				) : (
					<>
						{showAnnouncement && (
							<Announcement
								version={version}
								hideAnnouncement={hideAnnouncement}
								vscodeUriScheme={uriScheme}
							/>
						)}
						{!showAnnouncement && shouldShowKoduPromo && (
							<KoduPromo style={{ margin: "10px 15px -10px 15px" }} />
						)}

						<ChatScreen
							taskHistory={<HistoryPreview showHistoryView={showHistoryView} />}
							handleClick={(text) => {
								handleSendMessage(text)
							}}
						/>
					</>
				)}
				{task && (
					<>
						<ChatMessages
							visibleMessages={visibleMessages}
							syntaxHighlighterStyle={syntaxHighlighterStyle}
							expandedRows={expandedRows}
							toggleRowExpansion={toggleRowExpansion}
							handleSendStdin={handleSendStdin}
						/>
						<ButtonSection
							primaryButtonText={primaryButtonText}
							secondaryButtonText={secondaryButtonText}
							enableButtons={enableButtons}
							isRequestRunning={isAbortAllowed}
							handlePrimaryButtonClick={handlePrimaryButtonClick}
							handleSecondaryButtonClick={handleSecondaryButtonClick}
						/>
					</>
				)}
			</div>
			<div className="mt-2 border-t">
				{!task && <ProjectStarterChooser />}
				<InputArea
					inputValue={inputValue}
					setInputValue={setInputValue}
					textAreaDisabled={textAreaDisabled}
					handleSendMessage={handleSendMessage}
					placeholderText={placeholderText}
					selectedImages={selectedImages}
					setSelectedImages={setSelectedImages}
					shouldDisableImages={shouldDisableImages}
					selectImages={selectImages}
					thumbnailsHeight={thumbnailsHeight}
					handleThumbnailsHeightChange={handleThumbnailsHeightChange}
					isRequestRunning={!!isMessageRunning}
					isInTask={!!task}
					// @ts-expect-error - extract is not working here
					handleKeyDown={handleKeyDown}
					handlePaste={handlePaste}
				/>
			</div>
		</div>
	)
}

export default React.memo(ChatView)
