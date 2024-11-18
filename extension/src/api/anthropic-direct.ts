import { Anthropic } from "@anthropic-ai/sdk"
import { ApiHandler, withoutImageData } from "."
import { ApiHandlerOptions, KoduModelId, ModelInfo, koduModels } from "../shared/api"
import { ApiHistoryItem } from "../agent/v1"
import { WebSearchResponseDto } from "./interfaces"
import { KODU_ERROR_CODES, KoduError, koduSSEResponse } from "../shared/kodu"

export class AnthropicDirectHandler implements ApiHandler {
    private options: ApiHandlerOptions
    private client: Anthropic
    private abortController: AbortController | null = null

    constructor(options: ApiHandlerOptions) {
        this.options = options
        if (!options.apiKey) {
            throw new Error("Anthropic API key is required")
        }
        this.client = new Anthropic({
            apiKey: options.apiKey
        })
    }

    async abortRequest(): Promise<void> {
        if (this.abortController) {
            this.abortController.abort()
            this.abortController = null
        }
    }

    createUserReadableRequest(
        userContent: Array<
            | Anthropic.TextBlockParam
            | Anthropic.ImageBlockParam
            | Anthropic.ToolUseBlockParam
            | Anthropic.ToolResultBlockParam
        >
    ): any {
        return {
            model: this.getModel().id,
            max_tokens: this.getModel().info.maxTokens,
            system: "(Direct Anthropic API)",
            messages: [{ role: "user", content: withoutImageData(userContent) }]
        }
    }

    async *createMessageStream(
        systemPrompt: string,
        messages: ApiHistoryItem[],
        creativeMode?: "normal" | "creative" | "deterministic",
        abortSignal?: AbortSignal | null,
        customInstructions?: string,
        userMemory?: string,
        environmentDetails?: string
    ): AsyncIterableIterator<koduSSEResponse> {
        // Create a new AbortController
        this.abortController = new AbortController()

        try {
            // Build system prompt
            const system: string[] = []
            system.push(systemPrompt.trim())
            if (customInstructions?.trim()) {
                system.push(customInstructions.trim())
            }
            if (environmentDetails?.trim()) {
                system.push(environmentDetails.trim())
            }
            const systemPromptCombined = system.join("\n\n")

            // Convert messages to Anthropic format
            const anthropicMessages: Anthropic.Messages.MessageParam[] = messages.map(msg => {
                const { ts, ...message } = msg
                if (typeof message.content === 'string') {
                    return {
                        ...message,
                        content: [{ type: 'text' as const, text: message.content }]
                    }
                }
                return {
                    ...message,
                    content: message.content.map(block => {
                        if (typeof block === 'string') {
                            return { type: 'text' as const, text: block }
                        }
                        if ('type' in block && block.type === 'text') {
                            return block as Anthropic.TextBlockParam
                        }
                        return { type: 'text' as const, text: JSON.stringify(block) }
                    })
                }
            })

            // Get temperature settings
            const temperatures = {
                creative: { temperature: 0.3, top_p: 0.9 },
                normal: { temperature: 0.2, top_p: 0.8 },
                deterministic: { temperature: 0.1, top_p: 0.9 }
            }
            const { temperature, top_p } = temperatures[creativeMode || "normal"]

            // Start stream
            yield { code: 0, body: undefined }

            // Create stream
            const stream = await this.client.messages.create(
                {
                    model: this.getModel().id,
                    max_tokens: this.getModel().info.maxTokens,
                    system: systemPromptCombined,
                    messages: anthropicMessages,
                    temperature,
                    top_p,
                    stream: true
                },
                {
                    signal: this.abortController.signal
                }
            )

            let content: Anthropic.ContentBlock[] = []

            for await (const chunk of stream) {
                if (chunk.type === 'content_block_start') {
                    yield { code: 2, body: { text: "" } }
                } else if (chunk.type === 'content_block_delta') {
                    if ('text' in chunk.delta) {
                        yield { code: 2, body: { text: chunk.delta.text } }
                        content.push({ type: 'text', text: chunk.delta.text })
                    }
                } else if (chunk.type === 'message_delta') {
                    if ('content' in chunk.delta && Array.isArray(chunk.delta.content)) {
                        const text = chunk.delta.content
                            .map((c: { type: string; text?: string }) => (c.type === 'text' && c.text) || '')
                            .join('')
                        yield { code: 2, body: { text } }
                    }
                } else if (chunk.type === 'message_stop') {
                    if ('content' in chunk && Array.isArray(chunk.content)) {
                        yield {
                            code: 1,
                            body: {
                                anthropic: {
                                    id: `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                                    type: 'message',
                                    role: 'assistant',
                                    content,
                                    model: this.getModel().id,
                                    stop_reason: 'end_turn',
                                    stop_sequence: null,
                                    usage: {
                                        input_tokens: 0,
                                        output_tokens: 0,
                                        cache_creation_input_tokens: 0,
                                        cache_read_input_tokens: 0
                                    }
                                },
                                internal: {
                                    cost: 0,
                                    userCredits: 0,
                                    inputTokens: 0,
                                    outputTokens: 0,
                                    cacheCreationInputTokens: 0,
                                    cacheReadInputTokens: 0
                                }
                            }
                        }
                        return
                    }
                }
            }

            // Handle case where stream ends without a message_stop
            if (content.length > 0) {
                yield {
                    code: 1,
                    body: {
                        anthropic: {
                            id: `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                            type: 'message',
                            role: 'assistant',
                            content,
                            model: this.getModel().id,
                            stop_reason: 'end_turn',
                            stop_sequence: null,
                            usage: {
                                input_tokens: 0,
                                output_tokens: 0,
                                cache_creation_input_tokens: 0,
                                cache_read_input_tokens: 0
                            }
                        },
                        internal: {
                            cost: 0,
                            userCredits: 0,
                            inputTokens: 0,
                            outputTokens: 0,
                            cacheCreationInputTokens: 0,
                            cacheReadInputTokens: 0
                        }
                    }
                }
                return
            }

            throw new KoduError({
                code: KODU_ERROR_CODES.NETWORK_REFUSED_TO_CONNECT
            })

        } catch (error) {
            // Don't throw errors on abort
            if (error instanceof Error && error.message === "aborted") {
                return
            }

            // Handle other errors
            if (error instanceof Error) {
                if (error.message.includes("prompt is too long")) {
                    yield {
                        code: -1,
                        body: {
                            msg: "prompt is too long",
                            status: 413
                        }
                    }
                } else {
                    yield {
                        code: -1,
                        body: {
                            msg: error.message,
                            status: KODU_ERROR_CODES.NETWORK_REFUSED_TO_CONNECT
                        }
                    }
                }
            }
            return
        } finally {
            this.abortController = null
        }
    }

    getModel(): { id: KoduModelId; info: ModelInfo } {
        const modelId = this.options.apiModelId
        if (modelId && modelId in koduModels) {
            const id = modelId as KoduModelId
            return { id, info: koduModels[id] }
        }
        return { id: "claude-3-5-sonnet-20240620", info: koduModels["claude-3-5-sonnet-20240620"] }
    }

    // These methods are not supported in direct Anthropic integration
    async *sendWebSearchRequest(): AsyncIterableIterator<WebSearchResponseDto> {
        throw new Error("Web search is not supported with direct Anthropic API integration")
    }

    async sendUrlScreenshotRequest(): Promise<Blob> {
        throw new Error("URL screenshots are not supported with direct Anthropic API integration")
    }

    async sendAskConsultantRequest(): Promise<any> {
        throw new Error("Ask consultant is not supported with direct Anthropic API integration")
    }

    async sendSummarizeRequest(): Promise<any> {
        throw new Error("Summarize is not supported with direct Anthropic API integration")
    }
}
