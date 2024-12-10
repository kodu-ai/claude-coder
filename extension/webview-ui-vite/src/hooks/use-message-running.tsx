import { useCallback, useMemo, useState } from "react"
import {
	ClaudeMessage,
	ExtensionMessage,
	isV1ClaudeMessage,
	V1ClaudeMessage,
} from "../../../src/shared/extension-message"
import { useEvent } from "react-use"

export const useMessageRunning = (messages: ClaudeMessage[]) => {
	const [isRunning, setIsRunning] = useState(false)
	const handleMessage = useCallback((e: MessageEvent) => {
		const message: ExtensionMessage = e.data
		switch (message.type) {
			case "requestStatus":
				setIsRunning(message.isRunning)
				break
		}
	}, [])
	useEvent("message", handleMessage)
	return isRunning
}
