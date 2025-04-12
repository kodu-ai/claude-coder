import { BaseAgentTool } from "../base-agent.tool"
import { FileChangePlanToolParams } from "../definitions"

export class FileChangePlanTool extends BaseAgentTool<FileChangePlanToolParams> {
    async execute() {
        const { input, ask, say } = this.params
        const { plan, files } = input

        if (!plan) {
            await say(
                "error",
                "Kodu tried to submit a file change plan without specifying the plan. Retrying..."
            )
            return this.toolResponse("error", `
                <file_change_plan_response>
                    <status>
                        <r>error</r>
                        <operation>file_change_plan</operation>
                        <timestamp>${new Date().toISOString()}</timestamp>
                    </status>
                    <error_details>
                        <type>missing_parameter</type>
                        <message>Missing required parameter 'plan'</message>
                        <help>
                            <example_usage>
                                <tool>file_change_plan</tool>
                                <parameters>
                                    <plan>Detailed description of the changes to be made</plan>
                                    <files>
                                        <file>path/to/file1.js</file>
                                        <file>path/to/file2.js</file>
                                    </files>
                                </parameters>
                            </example_usage>
                        </help>
                    </error_details>
                </file_change_plan_response>
            `)
        }

        if (!files || !Array.isArray(files) || files.length === 0) {
            await say(
                "error",
                "Kodu tried to submit a file change plan without specifying the affected files. Retrying..."
            )
            return this.toolResponse("error", `
                <file_change_plan_response>
                    <status>
                        <r>error</r>
                        <operation>file_change_plan</operation>
                        <timestamp>${new Date().toISOString()}</timestamp>
                    </status>
                    <error_details>
                        <type>missing_parameter</type>
                        <message>Missing or empty required parameter 'files'</message>
                        <help>
                            <example_usage>
                                <tool>file_change_plan</tool>
                                <parameters>
                                    <plan>Detailed description of the changes to be made</plan>
                                    <files>
                                        <file>path/to/file1.js</file>
                                        <file>path/to/file2.js</file>
                                    </files>
                                </parameters>
                            </example_usage>
                        </help>
                    </error_details>
                </file_change_plan_response>
            `)
        }

        try {
            // Update UI to show plan submission is in progress
            await this.params.updateAsk(
                "tool",
                {
                    tool: {
                        tool: "file_change_plan",
                        plan,
                        files,
                        approvalState: "pending",
                        ts: this.ts
                    },
                },
                this.ts
            )

            // Get user approval for the plan
            const { text } = await ask(
                "tool",
                {
                    tool: {
                        tool: "file_change_plan",
                        plan,
                        files,
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
                            tool: "file_change_plan",
                            plan,
                            files,
                            approvalState: "rejected",
                            ts: this.ts
                        },
                    },
                    this.ts
                )
                
                await say(
                    "user_feedback",
                    "The file change plan was rejected. Please refine your plan or propose an alternative approach."
                )
                
                return this.toolResponse("error", `
                    <file_change_plan_response>
                        <status>
                            <r>error</r>
                            <operation>file_change_plan</operation>
                            <timestamp>${new Date().toISOString()}</timestamp>
                        </status>
                        <error_details>
                            <type>user_rejection</type>
                            <message>User rejected the file change plan</message>
                        </error_details>
                    </file_change_plan_response>
                `)
            }

            // Record the plan (assuming there's a method in koduDev for this)
            // This is a placeholder - actual implementation will depend on how plans are tracked
            await this.recordChangePlan(plan, files)

            // Update the tool status to approved
            await this.params.updateAsk(
                "tool",
                {
                    tool: {
                        tool: "file_change_plan",
                        plan,
                        files,
                        approvalState: "approved",
                        ts: this.ts
                    },
                },
                this.ts
            )

            await say(
                "user_feedback",
                "The file change plan has been approved. You can proceed with implementing the changes."
            )

            return this.toolResponse(
                "success",
                `<file_change_plan_response>
                    <status>
                        <r>success</r>
                        <operation>file_change_plan</operation>
                        <timestamp>${new Date().toISOString()}</timestamp>
                    </status>
                    <plan_details>
                        <plan>${plan}</plan>
                        <files>
                            ${files.map(file => `<file>${file}</file>`).join('\n                            ')}
                        </files>
                        <approval_status>approved</approval_status>
                    </plan_details>
                </file_change_plan_response>`
            )
        } catch (error) {
            await say(
                "error",
                `Error submitting file change plan: ${error instanceof Error ? error.message : String(error)}`
            )
            
            await this.params.updateAsk(
                "tool",
                {
                    tool: {
                        tool: "file_change_plan",
                        plan,
                        files,
                        approvalState: "error",
                        error: error instanceof Error ? error.message : String(error),
                        ts: this.ts
                    },
                },
                this.ts
            )
            
            return this.toolResponse("error", `
                <file_change_plan_response>
                    <status>
                        <r>error</r>
                        <operation>file_change_plan</operation>
                        <timestamp>${new Date().toISOString()}</timestamp>
                    </status>
                    <error_details>
                        <type>operation_error</type>
                        <message>${error instanceof Error ? error.message : String(error)}</message>
                    </error_details>
                </file_change_plan_response>
            `)
        }
    }

    // Placeholder method - actual implementation would involve the state manager
    private async recordChangePlan(plan: string, files: string[]): Promise<void> {
        // In a real implementation, this would use the state manager to track change plans
        console.log("Recording file change plan:", plan)
        console.log("Affected files:", files.join(", "))
    }
}