import * as path from "path"
import { serializeError } from "serialize-error"
import { BaseAgentTool } from "../../base-agent.tool"
import { getCwd, getReadablePath, isTextBlock } from "../../../utils"
import * as vscode from "vscode"
import { readFileAndFormat } from "../read-file/utils"
import prompts from "./file-change-plan.prompt"
import { DiagnosticsHandler } from "../../../handlers"
import { ApiHistoryItem } from "../../../types"
import ToolParser from "../../tool-parser/tool-parser"
import { rejectFileChangesTool } from "../../schema/reject-file-changes"
import { writeToFileTool } from "../../schema"
import { z } from "zod"
import { FileEditorTool } from "./file-editor.tool"
import { access } from "fs/promises"
import { AgentToolParams } from "../../types"
import { FileChangePlanParams } from "../../schema/file-change-plan"

export class FileChangePlanTool extends BaseAgentTool<FileChangePlanParams> {
	async execute() {
		const { input, ask, say, updateAsk } = this.params
		const { path: relPath, what_to_accomplish } = input

		if (!relPath) {
			await say(
				"error",
				"Kodu tried to use file_changes_plan without value for required parameter 'path'. Retrying..."
			)

			const errorMsg = `
            <file_changes_plan_response>
                <status>
                    <result>error</result>
                    <operation>file_changes_plan</operation>
                    <timestamp>${new Date().toISOString()}</timestamp>
                </status>
                <error_details>
                    <type>missing_parameter</type>
                    <message>Missing required parameter 'path'</message>
                    <help>
                        <example_usage>
                            <tool>file_changes_plan</tool>
                            <parameters>
                                <path>path/to/file</path>
                                <why>Explanation of relevance</why>
                            </parameters>
                        </example_usage>
                        <note>Both path and why parameters are required</note>
                    </help>
                </error_details>
            </file_changes_plan_response>`
			return this.toolResponse("error", errorMsg)
		}

		if (!what_to_accomplish) {
			await say(
				"error",
				"Kodu tried to use file_changes_plan without value for required parameter 'why'. Retrying..."
			)

			const errorMsg = `
            <file_changes_plan_response>
                <status>
                    <result>error</result>
                    <operation>file_changes_plan</operation>
                    <timestamp>${new Date().toISOString()}</timestamp>
                </status>
                <error_details>
                    <type>missing_parameter</type>
                    <message>Missing required parameter 'why'</message>
                    <help>
                        <example_usage>
                            <tool>file_changes_plan</tool>
                            <parameters>
                                <path>path/to/file</path>
                                <why>Explanation of relevance</why>
                            </parameters>
                        </example_usage>
                        <note>Both path and why parameters are required</note>
                    </help>
                </error_details>
            </file_changes_plan_response>`
			return this.toolResponse("error", errorMsg)
		}

		try {
			const absolutePath = path.resolve(this.cwd, relPath)

			const { response, text, images } = await ask(
				"tool",
				{
					tool: {
						tool: "file_changes_plan",
						path: getReadablePath(relPath, this.cwd),
						what_to_accomplish,
						approvalState: "pending",
						ts: this.ts,
					},
				},
				this.ts
			)

			if (response !== "yesButtonTapped") {
				await updateAsk(
					"tool",
					{
						tool: {
							tool: "file_changes_plan",
							path: getReadablePath(relPath, this.cwd),
							what_to_accomplish,
							approvalState: "rejected",
							ts: this.ts,
						},
					},
					this.ts
				)

				if (response === "messageResponse") {
					await updateAsk(
						"tool",
						{
							tool: {
								tool: "file_changes_plan",
								userFeedback: text,
								approvalState: "rejected",
								ts: this.ts,
								path: getReadablePath(relPath, this.cwd),
								what_to_accomplish,
							},
						},
						this.ts
					)
					await this.params.say("user_feedback", text ?? "The user denied this operation.", images)
					return this.toolResponse(
						"feedback",
						`<file_changes_plan_response>
                            <status>
                                <result>feedback</result>
                                <operation>file_changes_plan</operation>
                                <timestamp>${new Date().toISOString()}</timestamp>
                            </status>
                            <feedback_details>
                                <file>${absolutePath}</file>
                                <reason>${what_to_accomplish}</reason>
                                <user_feedback>${text || "No feedback provided"}</user_feedback>
                                ${images ? `<has_images>true</has_images>` : "<has_images>false</has_images>"}
                            </feedback_details>
                        </file_changes_plan_response>`,
						images
					)
				}

				return this.toolResponse(
					"rejected",
					`<file_changes_plan_response>
                        <status>
                            <result>rejected</result>
                            <operation>file_changes_plan</operation>
                            <timestamp>${new Date().toISOString()}</timestamp>
                        </status>
                        <rejection_details>
                            <file>${absolutePath}</file>
                            <reason>${what_to_accomplish}</reason>
                            <message>File tracking was rejected by the user</message>
                        </rejection_details>
                    </file_changes_plan_response>`
				)
			}

			await updateAsk(
				"tool",
				{
					tool: {
						tool: "file_changes_plan",
						path: getReadablePath(relPath, this.cwd),
						what_to_accomplish,
						approvalState: "approved",
						ts: this.ts,
					},
				},
				this.ts
			)

			const interestedFiles = (await this.koduDev.getStateManager().state.interestedFiles) ?? []
			const isTargetFileExists = await access(absolutePath)
				.then(() => true)
				.catch(() => false)
			let linterProblems = "No linter problems found"
			if (isTargetFileExists) {
				// first we open the file to ensure it's visible in vscode
				await vscode.window.showTextDocument(vscode.Uri.file(absolutePath))
				// then we wait 1s to ensure the file is opened and linter is loaded
				await new Promise((resolve) => setTimeout(resolve, 1000))
				// we are now going to gather the linter problems
				const diagnostics = await DiagnosticsHandler.getInstance().getDiagnostics([absolutePath])
				linterProblems = diagnostics[0].errorString ?? "No linter problems found"
			}
			const currentFile = {
				content: isTargetFileExists ? await readFileAndFormat(absolutePath) : "",
				path: absolutePath,
				why: what_to_accomplish,
				linterProblems,
			}
			// we are going to read the files latest content and then send it to the api
			const files = (
				await Promise.all(
					interestedFiles.map(async (file) => {
						try {
							const content = await readFileAndFormat(file.path)
							return { ...file, content }
						} catch (error) {
							return { ...file, content: "" }
						}
					})
				)
			).filter((file) => file.content.trim().length > 0) // we are filtering out empty files
			const systemPrompt: string[] = [prompts.mainPrompt(getCwd())]
			if (files.length > 0) {
				const filesPrompt = files
					// created time first in last out
					.sort((a, b) => b.createdAt - a.createdAt)
					.map((file) => prompts.interestedFilePrompt(file.path, file.why, file.content))
				systemPrompt.push(...filesPrompt)
			}
			let task = ""
			const apiHistory = this.koduDev.getStateManager().state.apiConversationHistory
			if (isTextBlock(apiHistory[0].content[0]) && apiHistory[0].content[0].text) {
				task = apiHistory[0].content[0].text
			}
			const messages: ApiHistoryItem[] = [
				...prompts.taskPrePromptPreFill(),
				{
					role: "user",
					content: [
						{
							type: "text",
							text: prompts.taskPrompt(task, currentFile),
						},
					],
				},
			]
			let finalTool: FileEditorTool | null = null
			let rejected: string | null = null
			let finalToolParamsFromEnd: any = null
			let finalToolResult: string | null = null

			const { params, options, cwd } = this
			const toolParser = new ToolParser(
				[
					rejectFileChangesTool.schema,
					writeToFileTool.schema,
					{
						name: "edit_file_blocks",
						schema: writeToFileTool.schema.schema,
					},
				],
				{
					async onToolUpdate(id, toolName, p, ts) {
						if (toolName === "reject_file_changes") {
							console.warn("Rejecting file changes")
							rejected = "rejected"
							return
						}
						if (toolName === "edit_file_blocks" || toolName === "write_to_file") {
							if (!finalTool) {
								finalTool = new FileEditorTool(
									{
										...params,
										...p,
										ts: Date.now(),
										name: toolName as "edit_file_blocks" | "write_to_file",
										input: {
											path: absolutePath,
											kodu_content: p.kodu_content,
											kodu_diff: p.kodu_diff,
										},
									},
									{
										...options,
									}
								)
							} else {
								finalTool.updateParams(p)
							}
							if (toolName === "edit_file_blocks") {
								finalTool.handlePartialUpdateDiff(absolutePath, p.kodu_diff)
							}
							if (toolName === "write_to_file") {
								finalTool.handlePartialUpdate(absolutePath, p.kodu_content)
							}
						}
					},
					async onToolError(id, toolName, error, ts) {
						console.error("Error in tool", toolName, error)
					},
					async onToolEnd(id, toolName, p, ts) {
						console.log("Tool ended", toolName)
						if (toolName === "reject_file_changes") {
							rejected = (p as z.infer<typeof rejectFileChangesTool.schema.schema>).reason
						}
						// Store final params so we can run finalTool later
						if (finalTool) {
							finalTool.updateParams(p)
							finalToolParamsFromEnd = p
						}
					},
				}
			)
			// here we will make call using api handler for separate branch
			const stream = await this.koduDev.getApiManager().getApi().createMessageStream({
				modelId: "claude-3-5-sonnet-20240620",
				systemPrompt,
				messages,
				abortSignal: this.AbortController.signal,
			})
			let finalContent = ""
			const tags = ["thinking", "self_critique", "action"] as const
			const tagMaker = (tag: string, isEnd: boolean = false) => `<${isEnd ? "/" : ""}${tag}>`
			const [thinkingTag, thinkingEndTag, selfCritiqueTag, selfCritiqueEndTag, actionTag, actionEndTag] = [
				tagMaker(tags[0]),
				tagMaker(tags[0], true),
				tagMaker(tags[1]),
				tagMaker(tags[1], true),
				tagMaker(tags[2]),
				tagMaker(tags[2], true),
			]
			for await (const chunk of stream) {
				if (chunk.code === 1) {
					// final message received
					if (chunk.body.anthropic.content[0].type === "text") {
						finalContent = chunk.body.anthropic.content[0].text
					}
					await toolParser.endParsing()
					console.log(`File Change Plan Final Cost:\n`, JSON.stringify(chunk.body.anthropic.usage))
					break
				}
				if (chunk.code === 2) {
					// partial message
					toolParser.appendText(chunk.body.text)
					finalContent += chunk.body.text
					// try to update either thinking or self_critique

					const thinkingIndex = finalContent.indexOf(thinkingTag)
					const selfCritiqueIndex = finalContent.indexOf(selfCritiqueTag)
					const actionIndex = finalContent.indexOf(actionTag)
					const actionEndIndex = finalContent.indexOf(actionEndTag)

					let innerThoughtsContent = ""
					let innerSelfCritiqueContent = ""
					let rejectedMessage: null | string = null

					// If we found a <thinking> tag, let's try to extract the content until either <self_critique> or the end of the current text
					if (thinkingIndex !== -1) {
						// start right after <thinking>
						const thinkingStart = thinkingIndex + thinkingTag.length

						// If we have found a <self_critique> tag, then thinking content ends right before that tag
						// If not, we just take until the end of the current partial content
						const thinkingEnd = selfCritiqueIndex !== -1 ? selfCritiqueIndex : finalContent.length

						innerThoughtsContent = finalContent.slice(thinkingStart, thinkingEnd).trim()
					}

					// If we found a <self_critique> tag, let's extract content after it.
					// However, we don't necessarily have an <action> tag yet. For partial updates,
					// we can just extract until the end of the finalContent or until another known tag appears.
					if (selfCritiqueIndex !== -1) {
						const selfCritiqueStart = selfCritiqueIndex + selfCritiqueTag.length

						// Check if there's another tag after self_critique that might mark the end
						// For simplicity, we'll stop at the next known tag <action> if it appears
						const tagEnd = finalContent.indexOf(selfCritiqueEndTag)
						const selfCritiqueEnd = tagEnd !== -1 ? tagEnd : finalContent.length

						innerSelfCritiqueContent = finalContent.slice(selfCritiqueStart, selfCritiqueEnd).trim()
					}

					if (actionIndex !== -1) {
						const actionStart = actionIndex + actionTag.length
						const actionEnd = actionEndIndex !== -1 ? actionEndIndex : finalContent.length
						const actionContent = finalContent.slice(actionStart, actionEnd).trim()

						// If we have <reason> in the action content, we can should extract <reason> until </reason> and update the tool with rejected message
						const reasonTag = "<reason>"
						const reasonStartIndex = actionContent.indexOf(reasonTag)
						const reasonEndTag = "</reason>"
						const reasonEndTagIndex = actionContent.indexOf(reasonEndTag)
						const reasonEnd = reasonEndTagIndex !== -1 ? reasonEndTagIndex : actionContent.length
						if (reasonStartIndex !== -1) {
							rejectedMessage = actionContent.slice(reasonStartIndex + reasonTag.length, reasonEnd).trim()
						}
					}

					// Now we only update if we have at least found <thinking> (as that’s our first tag)
					// If <self_critique> isn't found yet, innerSelfCritiqueContent will remain empty.
					if (thinkingIndex !== -1) {
						await updateAsk(
							"tool",
							{
								tool: {
									tool: "file_changes_plan",
									path: getReadablePath(relPath, this.cwd),
									what_to_accomplish,
									innerThoughts: innerThoughtsContent,
									innerSelfCritique: innerSelfCritiqueContent,
									approvalState: rejectedMessage ? "error" : "approved",
									rejectedString: rejectedMessage ?? undefined,
									ts: this.ts,
								},
							},
							this.ts
						)
					} else {
						// If we haven't reached the thinking tag yet, just do the default update
						// (Though this may not be necessary, it's here to maintain original behavior.)
						await updateAsk(
							"tool",
							{
								tool: {
									tool: "file_changes_plan",
									path: getReadablePath(relPath, this.cwd),
									what_to_accomplish,
									innerThoughts: "",
									innerSelfCritique: "",
									approvalState: "approved",
									ts: this.ts,
								},
							},
							this.ts
						)
					}
				}
				if (chunk.code === -1) {
					// error
					await toolParser.endParsing()
					throw new Error("Error in creating message stream")
				}
			}

			// Now that parsing has ended, if we have a finalTool and it ended, we can execute it
			if (finalTool !== null) {
				const res = await (finalTool as FileEditorTool).execute()
				finalToolResult = res.text ?? "No final tool result"
			}

			const [
				thinkingIndex,
				thinkingContextEndIndex,
				selfCritiqueIndex,
				selfCritiqueContextEndIndex,
				actionIndex,
				actionContextEndIndex,
			] = [
				finalContent.indexOf(thinkingTag),
				finalContent.indexOf(thinkingEndTag),
				finalContent.indexOf(selfCritiqueTag),
				finalContent.indexOf(selfCritiqueEndTag),
				finalContent.indexOf(actionTag),
				finalContent.indexOf(actionEndTag),
			]

			// Safely extract substring
			const thinkingContent = finalContent
				.slice(thinkingIndex + thinkingTag.length, thinkingContextEndIndex)
				.trim()
			const selfCritiqueContent = finalContent
				.slice(selfCritiqueIndex + selfCritiqueTag.length, selfCritiqueContextEndIndex)
				.trim()
			const actionContent = finalContent.slice(actionIndex + actionTag.length, actionContextEndIndex).trim()

			return this.toolResponse(
				"success",
				`<file_changes_plan_response>
                    <status>
						<operation>file_changes_plan</operation>
						<result>success</result>
						<timestamp>${new Date().toISOString()}</timestamp>
						<did_execute_changes>${
							rejected ?? "final change plan executed successfully and content has been updated."
						}</did_execute_changes>
						<target_file>${absolutePath}</target_file>
						<information>From now on the final_updated_content is the ${absolutePath} latest content, please put extra attention on inner_self_critique and inner_thoughts they are important parts in the road to successfully complete the task.</information>
                    </status>
                    <plan_result>
						<inner_self_critique>${selfCritiqueContent}</inner_self_critique>
						<inner_thoughts>${thinkingContent}</inner_thoughts>
						<action_response>${finalToolResult ?? "No final tool result"}</action_response>
                    </plan_result>
                </file_changes_plan_response>`
			)
		} catch (error) {
			const errorString = `
            <file_changes_plan_response>
                <status>
                    <result>error</result>
                    <operation>file_changes_plan</operation>
                    <timestamp>${new Date().toISOString()}</timestamp>
                </status>
                <error_details>
                    <type>tracking_error</type>
                    <message>Failed to track file</message>
                    <context>
                        <file>${path}</file>
                        <reason>${what_to_accomplish}</reason>
                        <error_data>${JSON.stringify(serializeError(error))}</error_data>
                    </context>
                    <help>
                        <example_usage>
                            <tool>file_changes_plan</tool>
                            <parameters>
                                <path>path/to/file</path>
                                <why>Explanation of relevance</why>
                            </parameters>
                        </example_usage>
                    </help>
                </error_details>
            </file_changes_plan_response>`
			await say(
				"error",
				`Error tracking file:\n${(error as Error).message ?? JSON.stringify(serializeError(error), null, 2)}`
			)

			return this.toolResponse("error", errorString)
		}
	}
}
