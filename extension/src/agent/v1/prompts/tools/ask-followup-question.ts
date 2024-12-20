import { ToolPromptSchema } from "../utils/types"

export const askFollowupQuestionPrompt: ToolPromptSchema = {
	name: "ask_followup_question",
	description:
		"Ask the user a question to gather additional information needed to complete the task. This tool should be used when you encounter ambiguities, need clarification, or require more details to proceed effectively. It allows for interactive problem-solving by enabling direct communication with the user. Use this tool judiciously to maintain a balance between gathering necessary information and avoiding excessive back-and-forth.",
	parameters: {
		question: {
			type: "string",
			description:
				"The question to ask the user. This should be a clear, specific question that addresses the information you need.",
			required: true,
		},
	},
	capabilities: [
		"You can use ask_followup_question tool to ask the user a question to gather additional information needed to complete the task. This tool should be used when you encounter ambiguities, need clarification, or require more details to proceed effectively, this is meant to enable direct communication with the user but should be used only when absolutely necessary or when the user directly asks for it.",
	],
	examples: [
		{
			description: "Ask a followup question",
			output: `<ask_followup_question>
<question>Your question here</question>
</ask_followup_question>`,
		},
	],
}
