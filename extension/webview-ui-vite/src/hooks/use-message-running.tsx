import { useMemo } from "react"
import { ClaudeMessage, isV1ClaudeMessage, V1ClaudeMessage } from "../../../src/shared/ExtensionMessage"
import { ChatTool } from "../../../src/shared/new-tools"

export const useMessageRunning = (messages: ClaudeMessage[]) => {
	return useMemo(() => {
		const lastMessage = messages.at(-1)

		if (lastMessage && lastMessage.ask && lastMessage.ask === "resume_task") {
			return false
		}

		if (lastMessage && isV1ClaudeMessage(lastMessage)) {
			const lastAsk = messages
				.slice()
				.reverse()
				.find((message) => message.type === "ask") as V1ClaudeMessage | undefined

			if (lastAsk && lastAsk.type === "ask" && lastAsk.ask === "tool") {
				const tool = JSON.parse(lastAsk.text || "{}") as ChatTool
				if (tool.approvalState === "pending" || tool.approvalState === "loading") {
					if (tool.tool === "ask_followup_question") return false
					return true
				}
			}

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
}
