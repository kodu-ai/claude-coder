import { BaseAgentTool } from "../base-agent.tool"
import { RejectFileChangesToolParams } from "../definitions"

export class RejectFileChangesTool extends BaseAgentTool<RejectFileChangesToolParams> {
    async execute() {
        const { input, say } = this.params
        const { reason } = input

        if (!reason) {
            await say(
                "error",
                "Kodu tried to reject file changes without specifying a reason. Retrying..."
            )
            return this.toolResponse("error", `
                <reject_file_changes_response>
                    <status>
                        <r>error</r>
                        <operation>reject_file_changes</operation>
                        <timestamp>${new Date().toISOString()}</timestamp>
                    </status>
                    <error_details>
                        <type>missing_parameter</type>
                        <message>Missing required parameter 'reason'</message>
                        <help>
                            <example_usage>
                                <tool>reject_file_changes</tool>
                                <parameters>
                                    <reason>Detailed explanation of why the changes are being rejected</reason>
                                </parameters>
                            </example_usage>
                        </help>
                    </error_details>
                </reject_file_changes_response>
            `)
        }

        try {
            // Update UI to show rejection is in progress
            await this.params.updateAsk(
                "tool",
                {
                    tool: {
                        tool: "reject_file_changes",
                        reason,
                        approvalState: "pending",
                        ts: this.ts
                    },
                },
                this.ts
            )

            // Process the rejection
            console.log("Processing file changes rejection with reason:", reason)
            
            // Update the tool status to completed
            await this.params.updateAsk(
                "tool",
                {
                    tool: {
                        tool: "reject_file_changes",
                        reason,
                        approvalState: "approved",
                        ts: this.ts
                    },
                },
                this.ts
            )

            await say(
                "user_feedback",
                `The file changes have been rejected. Reason: ${reason}`
            )

            return this.toolResponse(
                "success",
                `<reject_file_changes_response>
                    <status>
                        <r>success</r>
                        <operation>reject_file_changes</operation>
                        <timestamp>${new Date().toISOString()}</timestamp>
                    </status>
                    <details>
                        <reason>${reason}</reason>
                        <rejection_status>completed</rejection_status>
                    </details>
                </reject_file_changes_response>`
            )
        } catch (error) {
            await say(
                "error",
                `Error rejecting file changes: ${error instanceof Error ? error.message : String(error)}`
            )
            
            await this.params.updateAsk(
                "tool",
                {
                    tool: {
                        tool: "reject_file_changes",
                        reason,
                        approvalState: "error",
                        error: error instanceof Error ? error.message : String(error),
                        ts: this.ts
                    },
                },
                this.ts
            )
            
            return this.toolResponse("error", `
                <reject_file_changes_response>
                    <status>
                        <r>error</r>
                        <operation>reject_file_changes</operation>
                        <timestamp>${new Date().toISOString()}</timestamp>
                    </status>
                    <error_details>
                        <type>operation_error</type>
                        <message>${error instanceof Error ? error.message : String(error)}</message>
                    </error_details>
                </reject_file_changes_response>
            `)
        }
    }
}