import * as path from "path"
import { serializeError } from "serialize-error"

import { parseSourceCodeForDefinitionsTopLevel } from "../../../parse-source-code"
import { ClaudeSayTool } from "../../../shared/ExtensionMessage"
import { ToolResponse } from "../../types"
import { formatGenericToolFeedback, formatToolResponse, getReadablePath } from "../../utils"
import { AgentToolOptions, AgentToolParams } from "./types"
import { BaseAgentTool } from "./base-agent.tool"

export class ListCodeDefinitionNamesTool extends BaseAgentTool {
	protected params: AgentToolParams

	constructor(params: AgentToolParams, options: AgentToolOptions) {
		super(options)
		this.params = params
	}

	async execute(): Promise<ToolResponse> {
		const { input, ask, say } = this.params
		const { path: relDirPath } = input

		if (relDirPath === undefined) {
			await say(
				"error",
				"Claude tried to use list_code_definition_names without value for required parameter 'path'. Retrying..."
			)
			return `Error: Missing value for required parameter 'path'. Please retry with complete response.
			an example of a good listCodeDefinitionNames tool call is:
			{
				"tool": "list_code_definition_names",
				"path": "path/to/directory"
			}
			Please try again with the correct path, you are not allowed to list code definitions without a path.
			`
		}
		try {
			const absolutePath = path.resolve(this.cwd, relDirPath)
			const result = await parseSourceCodeForDefinitionsTopLevel(absolutePath)

			const message = JSON.stringify({
				tool: "listCodeDefinitionNames",
				path: getReadablePath(relDirPath),
				content: result,
			} as ClaudeSayTool)
			if (this.alwaysAllowReadOnly) {
				await say("tool", message)
			} else {
				const { response, text, images } = await ask("tool", message)
				if (response !== "yesButtonTapped") {
					if (response === "messageResponse") {
						await say("user_feedback", text, images)
						return formatToolResponse(await formatGenericToolFeedback(text), images)
					}
					return "The user denied this operation."
				}
			}

			return result
		} catch (error) {
			const errorString = `Error parsing source code definitions: ${JSON.stringify(serializeError(error))}`
			await say(
				"error",
				`Error parsing source code definitions:\n${
					error.message ?? JSON.stringify(serializeError(error), null, 2)
				}`
			)
			return errorString
		}
	}
}
