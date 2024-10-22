import * as path from 'node:path'
import { serializeError } from 'serialize-error'

import type { ToolResponse } from '../../types'
import { formatGenericToolFeedback, formatToolResponse, getReadablePath } from '../../utils'

import { ClaudeSayTool } from '../../../../shared/ExtensionMessage'
import { extractTextFromFile } from '../../../../utils/extract-text'
import { BaseAgentTool } from '../base-agent.tool'
import type { AgentToolOptions, AgentToolParams } from '../types'

export class ReadFileTool extends BaseAgentTool {
	protected params: AgentToolParams

	constructor(params: AgentToolParams, options: AgentToolOptions) {
		super(options)
		this.params = params
	}

	async execute(): Promise<ToolResponse> {
		const { input, ask, say } = this.params
		const { path: relPath } = input

		if (relPath === undefined) {
			await say('error', "Claude tried to use read_file without value for required parameter 'path'. Retrying...")

			return `Error: Missing value for required parameter 'path'. Please retry with complete response.
			An example of a good readFile tool call is:
			{
				"tool": "read_file",
				"path": "path/to/file.txt"
			}
			Please try again with the correct path, you are not allowed to read files without a path.
			`
		}
		try {
			const absolutePath = path.resolve(this.cwd, relPath)
			const content = await extractTextFromFile(absolutePath)

			const { response, text, images } = await ask(
				'tool',
				{
					tool: {
						tool: 'read_file',
						path: getReadablePath(relPath, this.cwd),
						approvalState: 'pending',
						content,
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
							tool: 'read_file',
							path: getReadablePath(relPath, this.cwd),
							approvalState: 'rejected',
							content,
							ts: this.ts,
						},
					},
					this.ts,
				)

				if (response === 'messageResponse') {
					await say('user_feedback', text, images)
					return formatToolResponse(formatGenericToolFeedback(text), images)
				}

				return 'The user denied this operation.'
			}
			ask(
				'tool',
				{
					tool: {
						tool: 'read_file',
						path: getReadablePath(relPath, this.cwd),
						approvalState: 'approved',
						content,
						ts: this.ts,
					},
				},
				this.ts,
			)
			if (content.trim().length === 0) {
				return 'The file is empty.'
			}
			return content.length > 0 ? content : 'The file is empty.'
		} catch (error) {
			ask(
				'tool',
				{
					tool: {
						tool: 'read_file',
						path: getReadablePath(relPath, this.cwd),
						content: 'Cannot read content',
						approvalState: 'error',
						ts: this.ts,
					},
				},
				this.ts,
			)
			const errorString = `
			Error reading file: ${JSON.stringify(serializeError(error))}
			An example of a good readFile tool call is:
			{
				"tool": "read_file",
				"path": "path/to/file.txt"
			}
			Please try again with the correct path, you are not allowed to read files without a path.
			`
			await say(
				'error',
				`Error reading file:\n${(error as Error).message ?? JSON.stringify(serializeError(error), null, 2)}`,
			)

			return errorString
		}
	}
}
