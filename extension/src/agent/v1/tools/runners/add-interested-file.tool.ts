import path from "path"
import { BaseAgentTool } from "../base-agent.tool"
import { AddInterestedFileToolParams } from "../definitions"

export class AddInterestedFileTool extends BaseAgentTool<AddInterestedFileToolParams> {
    async execute() {
        const { input, say } = this.params
        const { file_path, reason } = input

        if (!file_path) {
            await say(
                "error",
                "Kodu tried to add an interested file without specifying a file path. Retrying..."
            )
            return this.toolResponse("error", `
                <add_interested_file_response>
                    <status>
                        <r>error</r>
                        <operation>add_interested_file</operation>
                        <timestamp>${new Date().toISOString()}</timestamp>
                    </status>
                    <error_details>
                        <type>missing_parameter</type>
                        <message>Missing required parameter 'file_path'</message>
                        <help>
                            <example_usage>
                                <tool>add_interested_file</tool>
                                <parameters>
                                    <file_path>path/to/file.txt</file_path>
                                    <reason>Why this file is important for the task</reason>
                                </parameters>
                            </example_usage>
                        </help>
                    </error_details>
                </add_interested_file_response>
            `)
        }

        try {
            // Update UI to show operation is in progress
            await this.params.updateAsk(
                "tool",
                {
                    tool: {
                        tool: "add_interested_file",
                        file_path,
                        reason: reason || "No reason provided",
                        approvalState: "loading",
                        ts: this.ts
                    },
                },
                this.ts
            )

            // Normalize the file path
            const normalizedPath = path.isAbsolute(file_path) 
                ? file_path 
                : path.resolve(this.options.cwd, file_path)

            // Add file to interested files list (assuming there's a method in koduDev for this)
            // This is a placeholder - actual implementation will depend on how interested files are tracked
            const isAdded = await this.addToInterestedFiles(normalizedPath, reason)

            if (!isAdded) {
                await this.params.updateAsk(
                    "tool",
                    {
                        tool: {
                            tool: "add_interested_file",
                            file_path,
                            reason: reason || "No reason provided",
                            approvalState: "error",
                            error: "Failed to add file to interested files list",
                            ts: this.ts
                        },
                    },
                    this.ts
                )
                
                return this.toolResponse("error", `
                    <add_interested_file_response>
                        <status>
                            <r>error</r>
                            <operation>add_interested_file</operation>
                            <timestamp>${new Date().toISOString()}</timestamp>
                        </status>
                        <error_details>
                            <type>operation_failed</type>
                            <message>Failed to add file to interested files list</message>
                            <file_path>${file_path}</file_path>
                        </error_details>
                    </add_interested_file_response>
                `)
            }

            // Update the tool status to completed
            await this.params.updateAsk(
                "tool",
                {
                    tool: {
                        tool: "add_interested_file",
                        file_path,
                        reason: reason || "No reason provided",
                        approvalState: "approved",
                        ts: this.ts
                    },
                },
                this.ts
            )

            return this.toolResponse(
                "success",
                `<add_interested_file_response>
                    <status>
                        <r>success</r>
                        <operation>add_interested_file</operation>
                        <timestamp>${new Date().toISOString()}</timestamp>
                    </status>
                    <file>
                        <path>${file_path}</path>
                        <reason>${reason || "No reason provided"}</reason>
                    </file>
                </add_interested_file_response>`
            )
        } catch (error) {
            await say(
                "error",
                `Error adding interested file: ${error instanceof Error ? error.message : String(error)}`
            )
            
            await this.params.updateAsk(
                "tool",
                {
                    tool: {
                        tool: "add_interested_file",
                        file_path,
                        reason: reason || "No reason provided",
                        approvalState: "error",
                        error: error instanceof Error ? error.message : String(error),
                        ts: this.ts
                    },
                },
                this.ts
            )
            
            return this.toolResponse("error", `
                <add_interested_file_response>
                    <status>
                        <r>error</r>
                        <operation>add_interested_file</operation>
                        <timestamp>${new Date().toISOString()}</timestamp>
                    </status>
                    <error_details>
                        <type>operation_error</type>
                        <message>${error instanceof Error ? error.message : String(error)}</message>
                        <file_path>${file_path}</file_path>
                    </error_details>
                </add_interested_file_response>
            `)
        }
    }

    // Placeholder method - actual implementation would involve the state manager
    private async addToInterestedFiles(filePath: string, reason?: string): Promise<boolean> {
        try {
            // In a real implementation, this would use the state manager to track interested files
            // For now, we'll simulate success
            console.log(`Adding ${filePath} to interested files with reason: ${reason || 'No reason provided'}`)
            return true
        } catch (error) {
            console.error("Error adding file to interested files:", error)
            return false
        }
    }
}