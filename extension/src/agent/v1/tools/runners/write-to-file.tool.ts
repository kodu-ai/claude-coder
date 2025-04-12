import fs from "fs"
import path from "path"
import { BaseAgentTool } from "../base-agent.tool"
import { WriteToFileToolParams } from "../definitions"
import { formatString } from "../format-content"

export class WriteToFileTool extends BaseAgentTool<WriteToFileToolParams> {
    async execute() {
        const { input, ask, say } = this.params
        const { path: filePath, content } = input

        if (!filePath) {
            await say(
                "error",
                "Kodu tried to use write_to_file without specifying a file path. Retrying..."
            )
            return this.toolResponse("error", `
                <write_file_response>
                    <status>
                        <r>error</r>
                        <operation>write_to_file</operation>
                        <timestamp>${new Date().toISOString()}</timestamp>
                    </status>
                    <error_details>
                        <type>missing_parameter</type>
                        <message>Missing required parameter 'path'</message>
                        <help>
                            <example_usage>
                                <tool>write_to_file</tool>
                                <parameters>
                                    <path>path/to/file.txt</path>
                                    <content>File content here</content>
                                </parameters>
                            </example_usage>
                        </help>
                    </error_details>
                </write_file_response>
            `)
        }

        if (content === undefined) {
            await say(
                "error",
                "Kodu tried to use write_to_file without specifying content. Retrying..."
            )
            return this.toolResponse("error", `
                <write_file_response>
                    <status>
                        <r>error</r>
                        <operation>write_to_file</operation>
                        <timestamp>${new Date().toISOString()}</timestamp>
                    </status>
                    <error_details>
                        <type>missing_parameter</type>
                        <message>Missing required parameter 'content'</message>
                        <help>
                            <example_usage>
                                <tool>write_to_file</tool>
                                <parameters>
                                    <path>path/to/file.txt</path>
                                    <content>File content here</content>
                                </parameters>
                            </example_usage>
                        </help>
                    </error_details>
                </write_file_response>
            `)
        }

        try {
            // Update UI to show write operation is in progress
            await this.params.updateAsk(
                "tool",
                {
                    tool: {
                        tool: "write_to_file",
                        path: filePath,
                        content: formatString(content),
                        approvalState: "pending",
                        ts: this.ts
                    },
                },
                this.ts
            )

            // Get user approval for the write operation
            const { text } = await ask(
                "tool",
                {
                    tool: {
                        tool: "write_to_file",
                        path: filePath,
                        content: formatString(content),
                        approvalState: "pending",
                        ts: this.ts
                    },
                },
                this.ts
            )

            // Check if user approved
            if (text && text.toLowerCase().includes("reject")) {
                await this.params.updateAsk(
                    "tool",
                    {
                        tool: {
                            tool: "write_to_file",
                            path: filePath,
                            content: formatString(content),
                            approvalState: "rejected",
                            ts: this.ts
                        },
                    },
                    this.ts
                )
                
                return this.toolResponse("error", `
                    <write_file_response>
                        <status>
                            <r>error</r>
                            <operation>write_to_file</operation>
                            <timestamp>${new Date().toISOString()}</timestamp>
                        </status>
                        <error_details>
                            <type>user_rejection</type>
                            <message>User rejected the file write operation</message>
                        </error_details>
                    </write_file_response>
                `)
            }

            // Perform the write operation
            const absolutePath = path.isAbsolute(filePath) 
                ? filePath 
                : path.resolve(this.options.cwd, filePath)
            
            // Ensure directory exists
            const dirPath = path.dirname(absolutePath)
            await fs.promises.mkdir(dirPath, { recursive: true })
            
            // Write the file
            await fs.promises.writeFile(absolutePath, content)

            // Update the tool status to completed
            await this.params.updateAsk(
                "tool",
                {
                    tool: {
                        tool: "write_to_file",
                        path: filePath,
                        content: formatString(content),
                        approvalState: "approved",
                        ts: this.ts
                    },
                },
                this.ts
            )

            return this.toolResponse(
                "success",
                `<write_file_response>
                    <status>
                        <r>success</r>
                        <operation>write_to_file</operation>
                        <timestamp>${new Date().toISOString()}</timestamp>
                    </status>
                    <file>
                        <path>${filePath}</path>
                        <absolute_path>${absolutePath}</absolute_path>
                        <size>${content.length}</size>
                    </file>
                </write_file_response>`
            )
        } catch (error) {
            await say(
                "error",
                `Error writing to file: ${error instanceof Error ? error.message : String(error)}`
            )
            
            await this.params.updateAsk(
                "tool",
                {
                    tool: {
                        tool: "write_to_file",
                        path: filePath,
                        content: formatString(content),
                        approvalState: "error",
                        error: error instanceof Error ? error.message : String(error),
                        ts: this.ts
                    },
                },
                this.ts
            )
            
            return this.toolResponse("error", `
                <write_file_response>
                    <status>
                        <r>error</r>
                        <operation>write_to_file</operation>
                        <timestamp>${new Date().toISOString()}</timestamp>
                    </status>
                    <error_details>
                        <type>file_system_error</type>
                        <message>${error instanceof Error ? error.message : String(error)}</message>
                        <path>${filePath}</path>
                    </error_details>
                </write_file_response>
            `)
        }
    }
}