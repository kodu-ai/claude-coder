import { ClaudeMessage } from "@/types"

/**
 * Combines API request start and finish messages in an array of ClaudeMessages.
 *
 * This function looks for pairs of 'api_req_started' and 'api_req_finished' messages.
 * When it finds a pair, it combines them into a single 'api_req_combined' message.
 * The JSON data in the text fields of both messages are merged.
 *
 * @param messages - An array of ClaudeMessage objects to process.
 * @returns A new array of ClaudeMessage objects with API requests combined.
 *
 * @example
 * const messages = [
 *   { type: "say", say: "api_req_started", text: '{"request":"GET /api/data"}', ts: 1000 },
 *   { type: "say", say: "api_req_finished", text: '{"cost":0.005}', ts: 1001 }
 * ];
 * const result = combineApiRequests(messages);
 * // Result: [{ type: "say", say: "api_req_started", text: '{"request":"GET /api/data","cost":0.005}', ts: 1000 }]
 */
export function combineApiRequests(messages: ClaudeMessage[]): ClaudeMessage[] {
	const result: ClaudeMessage[] = []
	let currentApiRequest: ClaudeMessage | null = null

	for (const message of messages) {
		if (message.type === "say") {
			if (message.say === "api_req_started") {
				currentApiRequest = { ...message }
			} else if (message.say === "api_req_finished" && currentApiRequest) {
				try {
					const startData = JSON.parse(currentApiRequest.text || "{}")
					const finishData = JSON.parse(message.text || "{}")
					currentApiRequest.text = JSON.stringify({ ...startData, ...finishData })
					result.push(currentApiRequest)
					currentApiRequest = null
				} catch (error) {
					console.error("Error parsing JSON:", error)
					if (currentApiRequest) {
						result.push(currentApiRequest)
					}
					currentApiRequest = null
				}
			} else if (currentApiRequest) {
				result.push(currentApiRequest)
				currentApiRequest = null
				result.push(message)
			} else {
				result.push(message)
			}
		} else {
			if (currentApiRequest) {
				result.push(currentApiRequest)
				currentApiRequest = null
			}
			result.push(message)
		}
	}

	if (currentApiRequest) {
		result.push(currentApiRequest)
	}
	if (currentApiRequest === null) {
		// check if last message is either resume_task or resume_completed_task and the message before that is api_req_started
		// then add to api_req_started error message that it was aborted
		const lastMessage = result[result.length - 1]
		const secondLastMessage = result[result.length - 2]
		if (
			lastMessage &&
			secondLastMessage &&
			(lastMessage.ask === "resume_task" || lastMessage.ask === "resume_completed_task") &&
			secondLastMessage.say === "api_req_started"
		) {
			console.log(`REPLACE ABORTED MESSAGE`)
			// add a message that the request was aborted (error)
			// const abortedMessage: ClaudeMessage = {
			// 	ts: lastMessage.ts,
			// 	type: "say",
			// 	say: "error",
			// 	text: `API request aborted by user`,
			// }
			// // add it before the last message
			// result.splice(result.length - 1, 0, abortedMessage)
		}
	}

	return result
}
