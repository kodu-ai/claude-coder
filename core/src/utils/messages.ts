import { ClaudeMessage, V1ClaudeMessage } from "@/types"

export const isV1ClaudeMessage = (message: ClaudeMessage): message is V1ClaudeMessage => {
	return (message as V1ClaudeMessage).v === 1
}
