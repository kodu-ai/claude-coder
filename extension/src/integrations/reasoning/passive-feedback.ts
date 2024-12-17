import dedent from "dedent"
import { cloneDeep } from "lodash"
import { KoduDev, ApiHistoryItem } from "../../agent/v1"
import { getCwd } from "../../agent/v1/utils"
import { processConversationHistory } from "../../api/conversation-utils"
import { mainPrompts } from "../../agent/v1/prompts/main-new.prompt"

/**
 * This function:
 * 1. Retrieves the existing conversation history between Kodu (the agent) and a user.
 * 2. Pushes a user message that instructs the LLM to provide short, concise, critical feedback on the agent's performance and direction.
 * 3. The system prompt tells the LLM it is an external observer and must provide unbiased critique to help the agent self-correct.
 * 4. Streams the response and returns final usage and content.
 */
export async function generatePassiveFeedback(
	koduDev: KoduDev,
	abortSignal: AbortSignal
): Promise<{
	content: string
	usage: {
		cost: number
		userCredits: number
		inputTokens: number
		outputTokens: number
		cacheCreationInputTokens: number
		cacheReadInputTokens: number
	}
}> {
	// Retrieve the existing conversation (agent <-> user)
	const ogMessages = koduDev.getStateManager().state.apiConversationHistory
	const messages = cloneDeep(ogMessages)
	const lastMessage = messages[messages.length - 1]
	// check if the last message if from the user if not we reject the request or message content is not array
	if (!lastMessage || !Array.isArray(lastMessage.content) || lastMessage.role !== "user") {
		throw new Error("No user message found in the conversation history.")
	}
	const api = koduDev.getApiManager()
	const supportImages = api.getModelInfo().supportsImages
	const supportComputerUse = supportImages && api.getModelId().includes("sonnet")
	const baseSystem = mainPrompts.prompt(supportImages)
	const customInstructions = api.formatCustomInstructions()
	const systemPrompt: string[] = [baseSystem]
	if (customInstructions) {
		systemPrompt.push(customInstructions)
	}

	const apiManager = koduDev.getApiManager().getApi()

	// this method will process the conversation history and update the state
	await processConversationHistory(koduDev, messages, mainPrompts.criticalMsg)

	const stream = await apiManager.createMessageStream({
		modelId: koduDev.getApiManager().getModelId(),
		systemPrompt,
		messages,
		abortSignal,
		async updateAfterCacheInserts(messages, systemMessages) {
			const userMsgIndices = messages.reduce(
				(acc, msg, index) => (msg.role === "user" ? [...acc, index] : acc),
				[] as number[]
			)
			const lastUserMsgIndex = userMsgIndices[userMsgIndices.length - 2] ?? -1
			const secondLastMsgUserIndex = userMsgIndices[userMsgIndices.length - 3] ?? -1
			const firstUserMsgIndex = userMsgIndices[0] ?? -1
			// Prepare messages up to the last user message
			let messagesToCache: ApiHistoryItem[] = messages.map((msg, index) => {
				const { ts, commitHash, branch, preCommitHash, ...message } = msg

				if (index === lastUserMsgIndex || index === secondLastMsgUserIndex || index === firstUserMsgIndex) {
					return {
						...message,
						content:
							typeof message.content === "string"
								? [
										{
											type: "text",
											text: message.content,
											cache_control: { type: "ephemeral" },
										},
								  ]
								: message.content.map((content, contentIndex) =>
										contentIndex === message.content.length - 1
											? { ...content, cache_control: { type: "ephemeral" } }
											: content
								  ),
					}
				}
				return message
			})

			messagesToCache.push({
				role: "assistant",
				content: [
					{
						type: "text",
						text: "This was a prefilled message, please ignore me. i only need to provide self reflection and feedback about my progress so far in this task (Kodu)",
					},
				],
			})
			messagesToCache.push({
				role: "user",
				content: [
					{
						type: "text",
						text: dedent`
						HEY I've pasted with you all the previous conversation between me and Kodu AI, an AI autonomous coding agent.
						You are now observing a conversation that took place between an AI agent named Kodu and a user. Kodu had access to various tools (like file editing, searching, etc.) and it has been trying to solve the user's request step-by-step. Now I want you, as a neutral and external observer, to provide a very short and concise critical feedback about Kodu's overall current direction and behavior based on the conversation so far.
						Points to consider in your feedback:
						- Is Kodu on the right track or off track?
						- Is Kodu looping or stuck?
						- Does Kodu need more context or should it change approach?
						- Your feedback should be brutally honest, no pleasantries, no fluff. Just a few sentences of sharp critique that helps Kodu self-correct if needed.
						- Remember, this feedback is not for the user, but for Kodu to improve its performance.
						- Think about missing relationships or connections, incorrect assumptions, or any other issues you see.
						- Think about potential different solutions or approaches that Kodu could take incase kodu is looping (stuck doing multiple relatively similar edits in a row without making any progress).
						- Did kodu spend more than 3 edits on a single file without making any progress?
			
						Your feedback must be to the point and direct. No need to repeat instructions, just a concise evaluation of Kodu's current state and what it might need to do next.
						The more critical and to the point, the better avoid any unnecessary commentary or long explanations, ideally 2-6 sentences.

						Lastly You should only give feedback if the agent is making any progress in a long while, you should give guidance and feedback, don't confuse or throw Kodu into a loop or off track.
						For example if Kodu made many changes (4-6 changes) but didn't make any progress prompt him to re-think and explore the repoistory or ask for more information.
						For example if Kodu can't make any progress and you think he made too many regression to a single file prompt him to rollback and retry later after getting more information.
						Prompt Kodu to use search_symbol, explore_repo_folder, add_interested_file, ask_followup_question, attempt_completion and file_editor rollbacks if needed.
						YOUR OUTPUT should be:
						Here is my feedback about Kodu's current direction and behavior based on the conversation so far, an the last few messages.
						<third_party_observer_feedback>

						</third_party_observer_feedback>
						`.trim(),
					},
				],
			})
			messagesToCache.push({
				role: "assistant",
				content: [
					{
						type: "text",
						text: dedent`Here is my feedback about Kodu's current direction and behavior based on the conversation so far, an the last few messages.
						<third_party_observer_feedback>`.trim(),
					},
				],
			})

			// The system prompt: instructions for how the LLM should understand and respond
			systemMessages = []
			systemMessages.push({
				text: `You are a third-party observer who just read a conversation between an AI agent named Kodu and a user. Your job is to provide a short, direct critique of Kodu's approach and reasoning. This critique is not for the user, but to help Kodu self-correct. Imagine you are reviewing the agent's performance as a code reviewer or a strict mentor.
	- Be brief and to the point.
	- Focus on correctness, direction, and whether the agent is stuck or needs more info.
	- Do not include pleasantries or unnecessary commentary.
	- No repeating instructions, just a concise evaluation of where Kodu stands and what it might need to do next.
	- Not over confuse the agent with too many instructions or early warning, you should only give feedback when you see the agent is stuck or looping.

	Here is a bit of information to understand Kodu and it's capabilities:
	<kodu_info_card>
	Kodu is a Principal Software Engineer with 15 years of experience who uses a ReAct pattern.
	Kodu has access to a variety of tools including:
	- file_editor: to create/edit/rollback files
	- search_symbol: to find code symbols
	- add_interested_file: to track important files
	- server_runner: to run servers
	- execute_command: to run CLI commands
	- read_file: to read file contents
	- search_files: to do regex searches
	- list_files: to list files/directories
	- explore_repo_folder: to understand code structure
	- ask_followup_question: to get clarification from the user
	- attempt_completion: to finalize and present the result
	</kodu_info_card>
	`,
				type: "text",
			})
			return [messagesToCache, systemMessages]
		},
	})

	let finalContent = ""
	let usage = {
		cost: 0,
		userCredits: 0,
		inputTokens: 0,
		outputTokens: 0,
		cacheCreationInputTokens: 0,
		cacheReadInputTokens: 0,
	}

	for await (const message of stream) {
		switch (message.code) {
			case 2:
				// Partial text
				if (message.body && message.body.text) {
					finalContent += message.body.text
				}
				break

			case 1:
				// Finish
				if (message.body && message.body.internal) {
					console.log("Anthropic usage:", message.body.anthropic.usage)
					usage.cost = message.body.internal.cost
					usage.userCredits = message.body.internal.userCredits
					usage.inputTokens = message.body.internal.inputTokens
					usage.outputTokens = message.body.internal.outputTokens
					usage.cacheCreationInputTokens = message.body.internal.cacheCreationInputTokens
					usage.cacheReadInputTokens = message.body.internal.cacheReadInputTokens
				}
				break

			case -1:
				// Error / request failed
				throw new Error("Request to LLM failed or was aborted.")
		}
	}

	return {
		content: finalContent.trim(),
		usage,
	}
}
