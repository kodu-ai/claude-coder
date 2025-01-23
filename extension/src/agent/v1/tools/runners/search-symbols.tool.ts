import * as path from "path"
import { serializeError } from "serialize-error"
import { BaseAgentTool } from "../base-agent.tool"
import { getReadablePath } from "../../utils"
import * as vscode from "vscode"
import { SearchSymbolsToolParams } from "../schema/search_symbols"
import dedent from "dedent"
import { searchSymbolPrompt } from "../../prompts/tools/search-symbol"

export class SearchSymbolsTool extends BaseAgentTool<SearchSymbolsToolParams> {
	async execute() {
		const { input, ask, say } = this.params
		let symbolName = input.symbolName

		if (!symbolName) {
			await say(
				"error",
				"Kodu tried to use search_symbol without value for required parameter 'symbolName'. Retrying..."
			)

			const errorMsg = `
            <search_symbol_response>
                <status>
                    <result>error</result>
                    <operation>search_symbol</operation>
                    <timestamp>${new Date().toISOString()}</timestamp>
                </status>
                <error_details>
                    <type>missing_parameter</type>
                    <message>Missing required parameter 'symbolName'</message>
                    <help>
                        <example_usage>
						<kodu_action>${searchSymbolPrompt.examples[0].output}</kodu_action>
                        </example_usage>
                        <note>The symbolName parameter is required for symbol searching</note>
                    </help>
                </error_details>
            </search_symbol_response>`
			return this.toolResponse("error", errorMsg)
		}

		try {
			// Get workspace symbols matching the name
			const symbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
				"vscode.executeWorkspaceSymbolProvider",
				symbolName
			)

			const symbolsWithDefinitions = await Promise.all(
				(symbols || []).map(async (symbol) => {
					// If there's no location or no range, safely handle or skip
					if (!symbol.location?.uri || !symbol.location.range) {
						return {
							symbol,
							context: "",
							definitions: [],
						}
					}

					const document = await vscode.workspace.openTextDocument(symbol.location.uri)

					// Use optional chaining and fallback values to avoid undefined errors
					const range = symbol.location.range
					const startLine = Math.max(0, (range.start?.line ?? 0) - 2)
					const endLine = Math.min(document.lineCount - 1, (range.end?.line ?? 0) + 2)

					// Collect context lines
					const contextLines: string[] = []
					for (let i = startLine; i <= endLine; i++) {
						contextLines.push(document.lineAt(i).text)
					}

					// Get symbol definitions
					let definitions: vscode.Location[] = []
					try {
						definitions =
							(await vscode.commands.executeCommand<vscode.Location[]>(
								"vscode.executeDefinitionProvider",
								symbol.location.uri,
								range.start
							)) || []
					} catch {
						definitions = []
					}

					const mappedDefinitions = await Promise.all(
						definitions.map(async (def) => {
							if (!def.uri || !def.range) {
								return {
									uri: "",
									context: "",
								}
							}
							const defDoc = await vscode.workspace.openTextDocument(def.uri)
							const defStartLine = Math.max(0, (def.range.start?.line ?? 0) - 2)
							const defEndLine = Math.min(defDoc.lineCount - 1, (def.range.end?.line ?? 0) + 2)
							const defContextLines: string[] = []

							for (let i = defStartLine; i <= defEndLine; i++) {
								defContextLines.push(defDoc.lineAt(i).text)
							}

							return {
								uri: def.uri.fsPath,
								context: defContextLines.join("\n"),
							}
						})
					)

					return {
						symbol,
						context: contextLines.join("\n"),
						definitions: mappedDefinitions,
					}
				})
			)

			// Format the results
			const formattedResults = symbolsWithDefinitions.map((symbolData) => {
				const { symbol, context, definitions } = symbolData

				// If there's no location range, guard here as well
				const locationTag = symbol.location?.range
					? dedent`<location><file>${getReadablePath(symbol.location.uri.fsPath, this.cwd)}</file><line>${
							(symbol.location.range.start?.line ?? 0) + 1
					  }</line></location>`
					: `<location><file>Unknown</file><line>Unknown</line></location>`

				return dedent`<symbol><name>${symbol.name}</name><kind>${symbol.kind}</kind><container>${
					symbol.containerName || "global scope"
				}</container>${locationTag}<usage_context>${context}</usage_context><definitions>${definitions
					.map(
						(def) =>
							`<definition><file>${getReadablePath(def.uri, this.cwd)}</file><context>${
								def.context
							}</context></definition>`
					)
					.join("\n")}</definitions></symbol>`.trim()
			})

			const { response, text, images } = await ask(
				"tool",
				{
					tool: {
						tool: "search_symbol",
						symbolName,
						approvalState: "pending",
						content: formattedResults.join("\n"),
						ts: this.ts,
					},
				},
				this.ts
			)

			if (response !== "yesButtonTapped") {
				await this.params.updateAsk(
					"tool",
					{
						tool: {
							tool: "search_symbol",
							symbolName,
							approvalState: "rejected",
							content: formattedResults.join("\n"),
							ts: this.ts,
						},
					},
					this.ts
				)

				if (response === "messageResponse") {
					await this.params.updateAsk(
						"tool",
						{
							tool: {
								tool: "search_symbol",
								userFeedback: text,
								approvalState: "rejected",
								content: formattedResults.join("\n"),
								ts: this.ts,
								symbolName,
							},
						},
						this.ts
					)
					await this.params.say("user_feedback", text ?? "The user denied this operation.", images)
					return this.toolResponse(
						"feedback",
						`<search_symbol_response>
                            <status>
                                <result>feedback</result>
                                <operation>search_symbol</operation>
                                <timestamp>${new Date().toISOString()}</timestamp>
                            </status>
                            <feedback_details>
                                <symbol_name>${symbolName}</symbol_name>
                                <user_feedback>${text || "No feedback provided"}</user_feedback>
                                ${images ? `<has_images>true</has_images>` : "<has_images>false</has_images>"}
                            </feedback_details>
                        </search_symbol_response>`,
						images
					)
				}

				return this.toolResponse(
					"rejected",
					`<search_symbol_response>
                        <status>
                            <result>rejected</result>
                            <operation>search_symbol</operation>
                            <timestamp>${new Date().toISOString()}</timestamp>
                        </status>
                        <rejection_details>
                            <symbol_name>${symbolName}</symbol_name>
                            <message>Symbol search operation was rejected by the user</message>
                        </rejection_details>
                    </search_symbol_response>`
				)
			}

			await this.params.updateAsk(
				"tool",
				{
					tool: {
						tool: "search_symbol",
						symbolName,
						approvalState: "approved",
						content: formattedResults.join("\n"),
						ts: this.ts,
					},
				},
				this.ts
			)

			return this.toolResponse(
				"success",
				`<search_symbol_response>
                    <status>
                        <result>success</result>
                        <operation>search_symbol</operation>
                        <timestamp>${new Date().toISOString()}</timestamp>
                    </status>
                    <search_info>
                        <symbol_name>${symbolName}</symbol_name>
                        <matches_found>${symbolsWithDefinitions.length}</matches_found>
                    </search_info>
                    <results>
                        ${formattedResults.join("\n")}
                    </results>
                </search_symbol_response>`
			)
		} catch (error) {
			const errorString = `
            <search_symbol_response>
                <status>
                    <result>error</result>
                    <operation>search_symbol</operation>
                    <timestamp>${new Date().toISOString()}</timestamp>
                </status>
                <error_details>
                    <type>search_error</type>
                    <message>Failed to search symbols</message>
                    <context>
                        <symbol_name>${symbolName}</symbol_name>
                        <error_data>${JSON.stringify(serializeError(error))}</error_data>
                    </context>
                    <help>
                        <example_usage>
                            <tool>search_symbol</tool>
                            <parameters>
                                <symbolName>function or class name</symbolName>
                            </parameters>
                        </example_usage>
                    </help>
                </error_details>
            </search_symbol_response>`
			await say(
				"error",
				`Error searching symbols:\n${
					(error as Error).message ?? JSON.stringify(serializeError(error), null, 2)
				}`
			)

			return this.toolResponse("error", errorString)
		}
	}
}
