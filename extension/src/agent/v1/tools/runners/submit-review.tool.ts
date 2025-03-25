import { BaseAgentTool } from "../base-agent.tool"
import { SubmitReviewToolParams } from "../definitions"

export class SubmitReviewTool extends BaseAgentTool<SubmitReviewToolParams> {
    async execute() {
        const { input, ask, say } = this.params
        const { review } = input

        if (!review) {
            await say(
                "error",
                "Kodu tried to use submit_review without review content. Retrying..."
            )
            const errorMsg = `
            <review_tool_response>
                <status>
                    <result>error</result>
                    <operation>submit_review</operation>
                    <timestamp>${new Date().toISOString()}</timestamp>
                </status>
                <error_details>
                    <type>missing_parameter</type>
                    <message>Missing required parameter 'review'</message>
                    <help>
                        <example_usage>
                            <tool>submit_review</tool>
                            <parameters>
                                <review>
                                    <progress_summary>Summary of progress</progress_summary>
                                    <questions>
                                    - Question 1
                                    - Question 2
                                    </questions>
                                    <next_steps>Proposed next steps</next_steps>
                                </review>
                            </parameters>
                        </example_usage>
                        <note>Review content must be provided in XML format</note>
                    </help>
                </error_details>
            </review_tool_response>`
            return this.toolResponse("error", errorMsg)
        }

        // Submit the review for feedback
        const { text, images } = await ask(
            "tool",
            {
                tool: {
                    tool: "submit_review",
                    review,
                    approvalState: "pending",
                    ts: this.ts
                },
            },
            this.ts
        )

        // Update the review status
        await this.params.updateAsk(
            "tool",
            {
                tool: {
                    tool: "submit_review",
                    review,
                    approvalState: "approved",
                    ts: this.ts
                },
            },
            this.ts
        )

        await say("user_feedback", text ?? "", images)

        return this.toolResponse(
            "success",
            `<review_tool_response>
                <status>
                    <result>success</result>
                    <operation>submit_review</operation>
                    <timestamp>${new Date().toISOString()}</timestamp>
                </status>
                <review>${review}</review>
                <feedback>
                    <response>
                        <text>${text || ""}</text>
                        ${images ? `<has_images>true</has_images>` : "<has_images>false</has_images>"}
                    </response>
                    <metadata>
                        <response_type>${images ? "text_with_images" : "text_only"}</response_type>
                        <response_length>${text?.length || 0}</response_length>
                    </metadata>
                </feedback>
            </review_tool_response>`,
            images
        )
    }
}