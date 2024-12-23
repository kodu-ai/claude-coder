import { ToolPromptSchema } from "../utils/utils"

export const searchSymbolPrompt: ToolPromptSchema = {
	name: "search_symbol",
	description:
		"Request to find and understand code symbol (function, classe, method) in source files. This tool helps navigate and understand code structure by finding symbol definitions and their context. It's particularly useful for:\n- Understanding function implementations\n- Finding class definitions\n- Tracing method usage\n- Building mental models of code",
	parameters: {
		symbolName: {
			type: "string",
			description: "The name of the symbol to search for (e.g., function name, class name)",
			required: true,
		},
		path: {
			type: "string",
			description: `The path to search in (relative to {{cwd}})`,
			required: true,
		},
	},
	capabilities: [
		"You can use search_symbol tool to understand how a specific function, class, or method is implemented in the codebase it can help you map potential changes, relationships, and dependencies between different parts of the codebase.",
	],
	examples: [
		{
			description: "Using search_symbol to understand code",
			output: `<search_symbol>
<symbolName>handleUserAuth</symbolName>
<path>src/auth</path>
</search_symbol>`,
		},
	],
}
