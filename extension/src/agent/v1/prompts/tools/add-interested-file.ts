import { ToolPromptSchema } from "../utils/types"

export const addInterestedFilePrompt: ToolPromptSchema = {
	name: "add_interested_file",
	description:
		"Track files that are relevant to the current task, you must ensure the file exists before adding it to the list of interested files. This tool helps maintain context by:\n- Building a systematic understanding of the codebase\n- Tracking file dependencies\n- Documenting why files are important, what lines to focus on, and their impact on the task\n- Supporting better decision making\n- Directly increase the context of the file_editor tool but giving it visibility of the file context and why it's meaningful to the task and the proposed changes.",
	parameters: {
		path: {
			type: "string",
			description: `The path of the file to track (relative to {{cwd}}). Ensure the file exists before adding it, you cannot add a file that does not exist.`,
			required: true,
		},
		why: {
			type: "string",
			description:
				"Explanation of why this file is relevant to the current task, the potential lines that we should put extra attention to, and the impact it may have on the task.",
			required: true,
		},
	},
	capabilities: [
		"You can use add_interested_file tool to track files that are relevant to the current task, ensuring that the file exists before adding it. This tool helps maintain context by building a systematic understanding of the codebase, tracking file dependencies, and documenting why files are important, what lines to focus on, and their impact on the task.",
	],
	examples: [
		{
			description:
				"Tracking files that Kodu thinks are relevant and have high impact on the Task with add_interested_file",
			output: `<add_interested_file>
<path>src/auth/auth-service.ts</path>
<why>Contains core authentication logic about the user auth, it is critical to understand how it's relation may impact our task. (... you should write 2-3 lines why you choose it ...)</why>
</add_interested_file>`,
		},
	],
}
