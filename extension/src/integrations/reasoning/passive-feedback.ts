import { ApiHistoryItem, KoduDev } from "@/agent/v1"
import { cloneDeep } from "lodash"

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
	const ogMessages = await koduDev.getStateManager().getSavedApiConversationHistory()
	const messages = cloneDeep(ogMessages)
	const lastMessage = messages[messages.length - 1]
	// check if the last message if from the user if not we reject the request or message content is not array
	if (!lastMessage || !Array.isArray(lastMessage.content) || lastMessage.role !== "user") {
		throw new Error("No user message found in the conversation history.")
	}

	// The system prompt: instructions for how the LLM should understand and respond
	const systemPrompt = [
		`You are a third-party observer who just read a conversation between an AI agent named Kodu and a user. Your job is to provide a short, direct critique of Kodu's approach and reasoning. This critique is not for the user, but to help Kodu self-correct. Imagine you are reviewing the agent's performance as a code reviewer or a strict mentor. 
- Be brief and to the point. 
- Focus on correctness, direction, and whether the agent is stuck or needs more info. 
- Do not include pleasantries or unnecessary commentary. 
- No repeating instructions, just a concise evaluation of where Kodu stands and what it might need to do next.

Here is a bit of information to understand Kodu and it's capabilities:
<kodu_info_card>
Kodu is a Principal Software Engineer with 15 years of experience who uses a ReAct pattern. 
Kodu has access to a variety of tools including:
- file_editor: to create/edit/rollback files
- search_symbol: to find code symbols
- add_interested_file: to track important files
- server_runner_tool: to run servers
- execute_command: to run CLI commands
- read_file: to read file contents
- search_files: to do regex searches
- list_files: to list files/directories
- explore_repo_folder: to understand code structure
- ask_followup_question: to get clarification from the user
- attempt_completion: to finalize and present the result
</kodu_info_card>

`,
	]

	const apiManager = koduDev.getApiManager().getApi()

	const stream = await apiManager.createMessageStream({
		modelId: "claude-3-5-sonnet-20240620", // Adjust as needed
		systemPrompt,
		messages,
		abortSignal,
		appendAfterCacheToLastMessage(lastMessage) {
			lastMessage.content.push({
				type: "text",
				text: `You are now observing a conversation that took place between an AI agent named Kodu and a user. Kodu had access to various tools (like file editing, searching, etc.) and it has been trying to solve the user's request step-by-step. Now I want you, as a neutral and external observer, to provide a very short and concise critical feedback about Kodu's overall current direction and behavior based on the conversation so far. 
		Points to consider in your feedback:
		- Is Kodu on the right track or off track?
		- Is Kodu looping or stuck?
		- Does Kodu need more context or should it change approach?
		- Your feedback should be brutally honest, no pleasantries, no fluff. Just a few sentences of sharp critique that helps Kodu self-correct if needed.`,
			})
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
					console.log("Passive feedback Usage:", message.body.internal)
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
