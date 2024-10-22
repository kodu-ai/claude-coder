import * as path from 'node:path'
import { serializeError } from 'serialize-error'

import { parseSourceCodeForDefinitionsTopLevel } from '../../../../parse-source-code'
import { ClaudeSayTool } from '../../../../shared/ExtensionMessage'
import type { ToolResponse } from '../../types'
import { formatGenericToolFeedback, formatToolResponse, getReadablePath } from '../../utils'
import { BaseAgentTool } from '../base-agent.tool'
import type { AgentToolOptions, AgentToolParams } from '../types'

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
				'error',
				"Claude tried to use list_code_definition_names without value for required parameter 'path'. Retrying...",
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

			const { response, text, images } = await ask(
				'tool',
				{
					tool: {
						tool: 'list_code_definition_names',
						path: getReadablePath(relDirPath),
						approvalState: 'pending',
						content: result,
						ts: this.ts,
					},
				},
				this.ts,
			)
			if (response !== 'yesButtonTapped') {
				ask(
					'tool',
					{
						tool: {
							tool: 'list_code_definition_names',
							path: getReadablePath(relDirPath),
							approvalState: 'rejected',
							content: result,
							ts: this.ts,
						},
					},
					this.ts,
				)
				if (response === 'messageResponse') {
					await say('user_feedback', text, images)
					return formatToolResponse(await formatGenericToolFeedback(text), images)
				}
				return 'The user denied this operation.'
			}
			ask(
				'tool',
				{
					tool: {
						tool: 'list_code_definition_names',
						path: getReadablePath(relDirPath),
						approvalState: 'approved',
						content: result,
						ts: this.ts,
					},
				},
				this.ts,
			)
			return result
		} catch (error) {
			const errorString = `Error parsing source code definitions: ${JSON.stringify(serializeError(error))}`
			ask(
				'tool',
				{
					tool: {
						tool: 'list_code_definition_names',
						approvalState: 'rejected',
						path: getReadablePath(relDirPath),
						error: errorString,
						ts: this.ts,
					},
				},
				this.ts,
			)

			return errorString
		}
	}
}
