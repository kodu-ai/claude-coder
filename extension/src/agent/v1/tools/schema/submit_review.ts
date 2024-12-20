import { z } from "zod"

const schema = z.object({
    review: z.string().describe("A formatted XML string containing the progress summary, questions, and next steps"),
})

export type SubmitReviewToolParams = {
    name: "submit_review"
    input: z.infer<typeof schema>
}

export const submitReviewTool = {
    schema: {
        name: "submit_review" as const,
        schema,
    },
    examples: [
        `<submit_review>
<review>
<progress_summary>Implemented basic authentication flow with login/signup endpoints</progress_summary>
<questions>
- Should we add rate limiting to these endpoints?
- Is the current token expiration time of 24h appropriate?
</questions>
<next_steps>Will implement password reset flow after review</next_steps>
</review>
</submit_review>`,
    ],
}