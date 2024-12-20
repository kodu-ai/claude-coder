import { ToolPromptSchema } from "../utils/types"

export const exploreRepoFolderPrompt: ToolPromptSchema = {
	name: "explore_repo_folder",
	description:
		"Request to list definition names (classes, functions, methods, etc.) used in source code files at the top level of the specified directory. This tool provides insights into the codebase structure and important constructs, encapsulating high-level concepts and relationships that are crucial for understanding the overall architecture.",
	parameters: {
		path: {
			type: "string",
			description: `The path of the directory (relative to the current working directory {{cwd}}) to list top level source code definitions for.`,
			required: true,
		},
	},
	capabilities: [
		"You can use explore_repo_folder tool to list definition names (classes, functions, methods, etc.) used in source code files at the top level of the specified directory. This tool provides insights into the codebase structure and important constructs, encapsulating high-level concepts and relationships that are crucial for understanding the overall architecture.",
	],
	examples: [
		{
			description: "Explore repo folder",
			output: `<explore_repo_folder>
<path>Directory path here for example agent/tools</path>
</explore_repo_folder>`,
		},
	],
}
