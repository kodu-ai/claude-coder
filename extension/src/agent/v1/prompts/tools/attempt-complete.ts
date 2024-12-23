import { ToolPromptSchema } from "../utils/utils"

export const attemptCompletionPrompt: ToolPromptSchema = {
	name: "attempt_completion",
	description:
		"After each tool use, the user will respond with the result of that tool use, i.e. if it succeeded or failed, along with any reasons for failure. Once you've received the results of tool uses and can confirm that the task is complete, use this tool to present the result of your work to the user. The user may respond with feedback if they are not satisfied with the result, which you can use to make improvements and try again.",
	parameters: {
		result: {
			type: "string",
			description:
				"The result of the task. Formulate this result in a way that is final and does not require further input from the user. Don't end your result with questions or offers for further assistance.",
			required: true,
		},
	},
	capabilities: [
		"You can use attempt_completion tool to present the result of your work to the user, this tool is used after you've received the results of tool uses and can confirm that the task is complete, the user may respond with feedback if they are not satisfied with the result, which you can use to make improvements and try again.",
	],
	examples: [
		{
			description: "Attempt to complete the task",
			output: `<attempt_completion>
<result>
Your final result description here
</result>
</attempt_completion>`,
		},
	],
}
