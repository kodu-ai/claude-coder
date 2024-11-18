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

    async *createBaseMessageStream(
        systemPrompt: string,
        messages: Anthropic.Messages.MessageParam[],
        abortSignal?: AbortSignal | null,
        temperature?: number,
        top_p?: number
    ): AsyncIterableIterator<koduSSEResponse> {
        try {
            // Create a new AbortController
            this.abortController = new AbortController()

            // Create a composite signal that aborts if either source aborts
            const signal = abortSignal 
                ? AbortSignal.any([abortSignal, this.abortController.signal])
                : this.abortController.signal

            const stream = await this.client.messages.create(
                {
                    model: this.getModel().id,
                    max_tokens: this.getModel().info.maxTokens,
                    system: systemPrompt,
                    messages,
                    temperature: temperature ?? 0.2,
                    top_p: top_p ?? 0.8,
                    stream: true
                },
                {
                    signal
                }
            )

            let content: Anthropic.ContentBlock[] = []
            let hasStarted = false

            for await (const chunk of stream) {
                if (chunk.type === 'message_start') {
                    if (!hasStarted) {
                        hasStarted = true
                        yield { code: 0, body: undefined }
                    }
                } else if (chunk.type === 'content_block_start') {
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

            // If we get here with no content, throw an error
            throw new KoduError({
                code: KODU_ERROR_CODES.NETWORK_REFUSED_TO_CONNECT
            })

        } catch (error) {
            // Convert errors to KoduError
            if (error instanceof Error && error.message === "aborted") {
                error = new KoduError({ code: KODU_ERROR_CODES.NETWORK_REFUSED_TO_CONNECT })
            }

            // Yield error response
            if (error instanceof KoduError) {
                yield {
                    code: -1,
                    body: {
                        msg: error.message || "Request aborted by user",
                        status: error.errorCode || KODU_ERROR_CODES.NETWORK_REFUSED_TO_CONNECT
                    }
                }
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
                return
            }

            // Throw unknown errors
            throw error
        } finally {
            this.abortController = null
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
        const system: string[] = []

        // Add system prompt
        system.push(systemPrompt.trim())

        // Add custom instructions
        if (customInstructions?.trim()) {
            system.push(customInstructions.trim())
        }

        // Add environment details
        if (environmentDetails?.trim()) {
            system.push(environmentDetails.trim())
        }

        const systemPromptCombined = system.join("\n\n")

        // Convert ApiHistoryItem[] to Anthropic message format
        const anthropicMessages: Anthropic.Messages.MessageParam[] = messages.map(msg => {
            const { ts, ...message } = msg

            // If content is a string convert to text block array
            if (typeof message.content === 'string') {
                return {
                    ...message,
                    content: [{
                        type: 'text' as const,
                        text: message.content
                    }]
                }
            }

            // If content is already an array ensure each item is properly formatted
            return {
                ...message,
                content: message.content.map(block => {
                    if (typeof block === 'string') {
                        return {
                            type: 'text' as const,
                            text: block
                        }
                    }
                    if ('type' in block) {
                        if (block.type === 'text') {
                            return block as Anthropic.TextBlockParam
                        }
                        // Convert tool messages to text blocks
                        return {
                            type: 'text' as const,
                            text: JSON.stringify(block)
                        }
                    }
                    return {
                        type: 'text' as const,
                        text: JSON.stringify(block)
                    }
                })
            }
        })

        const temperatures = {
            creative: { temperature: 0.3, top_p: 0.9 },
            normal: { temperature: 0.2, top_p: 0.8 },
            deterministic: { temperature: 0.1, top_p: 0.9 }
        }

        const { temperature, top_p } = temperatures[creativeMode || "normal"]

        yield* this.createBaseMessageStream(
            systemPromptCombined,
            anthropicMessages,
            abortSignal,
            temperature,
            top_p
        )
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
