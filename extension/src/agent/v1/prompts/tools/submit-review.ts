import { ToolPromptSchema } from "../utils/types"

export const submitReviewPrompt: ToolPromptSchema = {
    name: "submit_review",
    description:
        "Submit the current progress for review with questions or concerns. This tool helps maintain quality by prompting for self-review and gathering feedback on specific aspects of the implementation. Use this when you want to validate your approach or get feedback on specific decisions.",
    parameters: {
        review: {
            type: "string",
            description: "A formatted string containing the progress summary, questions, and next steps in XML format",
            required: true,
        },
    },
    capabilities: [
        "You can use submit_review tool to submit your current progress for review, including what you've accomplished, questions you have, and proposed next steps. This helps ensure quality and get feedback on your approach.",
    ],
    examples: [
        {
            description: "Submit a review with progress, questions, and next steps",
            output: `<submit_review>
<review>
<progress_summary>Implemented basic authentication flow with login/signup endpoints</progress_summary>
<questions>
- Should we add rate limiting to these endpoints?
- Is the current token expiration time of 24h appropriate?
</questions>
<next_steps>Will implement password reset flow after review</next_steps>
</review>
</submit_review>`,
        },
    ],
}