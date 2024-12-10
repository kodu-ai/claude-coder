import { serializeError } from "serialize-error"
import { BaseAgentTool } from "../base-agent.tool"
import { AgentToolOptions, AgentToolParams, ToolResponse } from "../types"
import { ActionRecord, ReflectionParams, ReflectionResult } from "../../types/reflection"

export class ReflectionTool extends BaseAgentTool {
    protected params: AgentToolParams
    private abortController: AbortController

    constructor(params: AgentToolParams, options: AgentToolOptions) {
        super(options)
        this.params = params
        this.abortController = new AbortController()
    }

    private createReflectionPrompt(params: ReflectionParams): string {
        const { actions, focus, limit } = params
        const relevantActions = limit ? actions.slice(-limit) : actions

        return `
As a reflection system, analyze the following sequence of actions taken during task execution.
Focus on ${focus || 'overall effectiveness'} and provide structured insights.

Action History:
${this.formatActionsForReflection(relevantActions)}

Analyze the above sequence and provide:
1. Patterns: What patterns do you observe in the action sequence?
2. Successes: Which strategies or approaches worked well?
3. Improvements: What could be improved or done differently?
4. Adjustments: What specific adjustments would you recommend for future actions?
5. Summary: Provide a concise summary of key insights.

Format your response in a structured JSON format matching the ReflectionResult interface.
`
    }

    private formatActionsForReflection(actions: ActionRecord[]): string {
        return actions.map(action => {
            const outcomeStatus = typeof action.outcome === 'string' 
                ? 'unknown' 
                : action.outcome.status || 'unknown'
            
            return `
Action: ${action.toolName}
Reasoning: ${action.reasoning}
Parameters: ${JSON.stringify(action.params, null, 2)}
Outcome: ${outcomeStatus}
${action.error ? `Error: ${action.error}` : ''}
Timestamp: ${new Date(action.timestamp).toISOString()}
            `
        }).join('\n---\n')
    }

    private parseReflectionResponse(response: string): ReflectionResult {
        try {
            const parsed = JSON.parse(response)
            return {
                patterns: Array.isArray(parsed.patterns) ? parsed.patterns : [],
                successes: Array.isArray(parsed.successes) ? parsed.successes : [],
                improvements: Array.isArray(parsed.improvements) ? parsed.improvements : [],
                adjustments: Array.isArray(parsed.adjustments) ? parsed.adjustments : [],
                summary: typeof parsed.summary === 'string' ? parsed.summary : 'No summary provided'
            }
        } catch (error) {
            console.error('Error parsing reflection response:', error)
            return {
                patterns: ['Error parsing reflection response'],
                successes: [],
                improvements: ['Improve reflection response parsing'],
                adjustments: ['Ensure reflection response is valid JSON'],
                summary: 'Failed to parse reflection response'
            }
        }
    }

    async execute(): Promise<ToolResponse> {
        const { input, ask, say } = this.params
        const reflectionParams = input as ReflectionParams

        if (!reflectionParams.actions || !Array.isArray(reflectionParams.actions)) {
            const errorMsg = 'Invalid or missing actions array in reflection parameters'
            await say("error", errorMsg)
            return this.toolResponse("error", errorMsg)
        }

        try {
            const prompt = this.createReflectionPrompt(reflectionParams)
            
            // Ask for approval before proceeding with reflection
            const { response, text } = await ask(
                "tool",
                {
                    tool: {
                        tool: "reflection",
                        prompt,
                        approvalState: "pending",
                        ts: this.ts
                    }
                },
                this.ts
            )

            if (response !== "yesButtonTapped") {
                await this.params.updateAsk(
                    "tool",
                    {
                        tool: {
                            tool: "reflection",
                            prompt,
                            approvalState: "rejected",
                            userFeedback: text,
                            ts: this.ts
                        }
                    },
                    this.ts
                )
                return this.toolResponse("error", "Reflection cancelled by user")
            }

            // Make the reflection API call using the same Claude instance
            const reflectionResponse = await this.koduDev.getApiManager().createApiStreamRequest(
                [{ role: 'user', content: prompt }],
                this.abortController.signal,
                this.abortController
            )

            // Get the first response from the stream
            const { value } = await reflectionResponse.next()
            const result = this.parseReflectionResponse(value?.body?.text || '{}')

            await this.params.updateAsk(
                "tool",
                {
                    tool: {
                        tool: "reflection",
                        result,
                        approvalState: "approved",
                        ts: this.ts
                    }
                },
                this.ts
            )

            return this.toolResponse(
                "success",
                `<reflection_response>
                    <status>
                        <result>success</result>
                        <operation>reflection</operation>
                        <timestamp>${new Date().toISOString()}</timestamp>
                    </status>
                    <reflection_result>
                        <patterns>${result.patterns.join('\n')}</patterns>
                        <successes>${result.successes.join('\n')}</successes>
                        <improvements>${result.improvements.join('\n')}</improvements>
                        <adjustments>${result.adjustments.join('\n')}</adjustments>
                        <summary>${result.summary}</summary>
                    </reflection_result>
                </reflection_response>`
            )
        } catch (error) {
            const errorMsg = `Error during reflection: ${JSON.stringify(serializeError(error))}`
            await say("error", errorMsg)
            return this.toolResponse("error", errorMsg)
        }
    }

    override async abortToolExecution(): Promise<void> {
        this.abortController.abort()
    }
}