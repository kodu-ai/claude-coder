import { ApiHandler, ApiConstructorOptions, koduSSEResponse } from "../types"
import { GlobalStateManager } from "../../shared/global-state-manager"
import { streamText } from "ai-sdk"
import { convertToAISDKFormat } from "../utils/convert-to-ai-sdk-format"
import { providerToAISDKModel } from "../utils/provider-to-ai-sdk-model"
import { smoothStream } from "../utils/smooth-stream"
import { calculateApiCost } from "../utils/calculate-api-cost"
import { PROVIDER_IDS } from "../config"
import { nanoid } from 'nanoid'

export class TeachingBotHandler implements ApiHandler {
    private _options: ApiConstructorOptions
    private abortController: AbortController | null = null
    private mainChatbot: ApiHandler | null = null

    get options() {
        return this._options
    }

    constructor(options: ApiConstructorOptions, mainChatbot: ApiHandler) {
        this._options = options
        this.mainChatbot = mainChatbot
    }

    async abortRequest(): Promise<void> {
        if (this.abortController) {
            this.abortController.abort("Request aborted by user")
            this.abortController = null
        }
    }

    async *createMessageStream({
        messages,
        systemPrompt,
        top_p,
        tempature,
        abortSignal,
        modelId,
        appendAfterCacheToLastMessage,
        updateAfterCacheInserts,
    }: Parameters<ApiHandler["createMessageStream"]>[0]): AsyncIterableIterator<koduSSEResponse> {
        // Dodaj specjalny prompt dla bota nauczającego
        const teachingSystemPrompt = [
            ...systemPrompt,
            `You are a teaching assistant bot that helps in learning process. Your responsibilities:
            1. Analyze context and determine learning objectives
            2. Break down complex topics into manageable chunks
            3. Provide examples and explanations
            4. Ask questions to verify understanding
            5. Search for additional resources when needed
            6. Communicate with the main chatbot to coordinate learning
            7. Track progress and adapt the learning path
            8. Provide feedback and suggestions for improvement
            
            Remember to:
            - Keep track of what has been learned
            - Adapt to the user's learning style
            - Provide relevant examples
            - Break down complex topics
            - Verify understanding through questions
            - Search for additional resources when needed
            - Maintain communication with main chatbot
            `
        ]

        const convertedMessages = convertToAISDKFormat(messages)
        const currentModel = this._options.models.find((m) => m.id === modelId) ?? this._options.model

        // Konfiguracja myślenia dla modelu
        let thinkingConfig = undefined
        if (modelId === "claude-3-7-sonnet-20250219") {
            const globalStateManager = GlobalStateManager.getInstance()
            const thinking = globalStateManager.getGlobalState("thinking")
            if (thinking) {
                tempature = 1
                thinkingConfig = thinking
                if (thinkingConfig.type === "enabled") {
                    thinking.budget_tokens = thinking.budget_tokens ?? 32_000
                }
            }
        }

        const result = streamText({
            providerOptions: {
                anthropic: {
                    thinking: { type: "enabled", budgetTokens: 12000 },
                },
            },
            model: providerToAISDKModel(this._options, modelId),
            messages: convertedMessages,
            temperature: currentModel.id === "deepseek-reasoner" ? undefined : tempature ?? 0.1,
            topP: top_p ?? undefined,
            stopSequences: ["</teaching_action>"],
            abortSignal: abortSignal ?? undefined,
            experimental_transform: smoothStream(),
            maxRetries: 3,
        })

        let text = ""
        for await (const part of result.fullStream) {
            if (part.type === "reasoning") {
                yield {
                    code: 4,
                    body: {
                        reasoningDelta: part.textDelta,
                    },
                }
            }
            if (part.type === "text-delta") {
                text += part.textDelta
                yield {
                    code: 2,
                    body: {
                        text: part.textDelta,
                    },
                }
            }
            if (part.type === "finish") {
                let cache_creation_input_tokens: number | null = null
                let cache_read_input_tokens: number | null = null

                if (this._options.providerSettings.providerId === PROVIDER_IDS.ANTHROPIC) {
                    part.usage.promptTokens = part.usage.promptTokens ?? 0
                    const cachedCreationTokens = part.providerMetadata?.["anthropic"]?.cacheCreationInputTokens
                    const cachedPromptTokensRead = part.providerMetadata?.["anthropic"]?.cacheReadInputTokens
                    if (typeof cachedPromptTokensRead === "number" && typeof cachedCreationTokens === "number") {
                        cache_read_input_tokens = cachedPromptTokensRead ?? 0
                        cache_creation_input_tokens = cachedCreationTokens
                    }
                }

                yield {
                    code: 1,
                    body: {
                        anthropic: {
                            content: [
                                {
                                    type: "text",
                                    text,
                                },
                            ],
                            id: `teaching-${nanoid()}`,
                            role: "assistant",
                            stop_reason: "stop_sequence",
                            type: "message",
                            stop_sequence: "</teaching_action>",
                            model: modelId,
                            usage: {
                                input_tokens: part.usage.promptTokens - (cache_creation_input_tokens ?? 0) - (cache_read_input_tokens ?? 0),
                                output_tokens: part.usage.completionTokens,
                                cache_creation_input_tokens,
                                cache_read_input_tokens,
                            },
                        },
                        internal: {
                            cost: calculateApiCost(
                                currentModel,
                                part.usage.promptTokens - (cache_creation_input_tokens ?? 0) - (cache_read_input_tokens ?? 0),
                                part.usage.completionTokens,
                                cache_creation_input_tokens ?? 0,
                                cache_read_input_tokens ?? 0
                            ),
                            inputTokens: part.usage.promptTokens - (cache_creation_input_tokens ?? 0) - (cache_read_input_tokens ?? 0),
                            outputTokens: part.usage.completionTokens,
                            cacheCreationInputTokens: cache_creation_input_tokens ?? 0,
                            cacheReadInputTokens: cache_read_input_tokens ?? 0,
                        },
                    },
                }
            }
            if (part.type === "error") {
                console.error(part.error)
            }
        }
    }

    getModel(): { id: string; info: ModelInfo } {
        return {
            id: this._options.model.id,
            info: this._options.model,
        }
    }

    // Metody do komunikacji z głównym chatbotem
    async communicateWithMainBot(message: string): Promise<string> {
        if (!this.mainChatbot) {
            throw new Error("Main chatbot not initialized")
        }

        const response = this.mainChatbot.createMessageStream({
            messages: [
                {
                    role: "user",
                    content: message
                }
            ],
            systemPrompt: ["You are communicating with teaching bot"],
            modelId: this._options.model.id
        })

        let fullResponse = ""
        for await (const part of response) {
            if (part.code === 2 && part.body.text) {
                fullResponse += part.body.text
            }
        }

        return fullResponse
    }

    // Metody do śledzenia postępów w nauce
    private learningProgress = new Map<string, {
        topic: string
        status: "not_started" | "in_progress" | "completed"
        score: number
        lastUpdate: Date
    }>()

    trackProgress(topic: string, status: "not_started" | "in_progress" | "completed", score: number = 0) {
        this.learningProgress.set(topic, {
            topic,
            status,
            score,
            lastUpdate: new Date()
        })
    }

    getLearningProgress(topic: string) {
        return this.learningProgress.get(topic)
    }

    // Metoda do adaptacji ścieżki nauczania
    async adaptLearningPath(topic: string, userPerformance: number): Promise<string> {
        const progress = this.getLearningProgress(topic)
        if (!progress) {
            return "Starting new learning path for " + topic
        }

        if (userPerformance < 0.6) {
            return "Let's review the basics of " + topic
        } else if (userPerformance < 0.8) {
            return "You're doing well! Let's try some more advanced concepts."
        } else {
            return "Excellent! Let's move to the next topic."
        }
    }

    // Metoda do wyszukiwania dodatkowych zasobów
    async searchResources(topic: string): Promise<string[]> {
        try {
            // Użyj mainChatbot do wyszukania zasobów
            const query = `Find learning resources for topic: ${topic}. Return only URLs to documentation, tutorials and best practices.`
            const response = await this.communicateWithMainBot(query)

            // Parsuj odpowiedź, zakładając że zawiera linki
            const urls = response.match(/https?:\/\/[^\s)]+/g) || []

            // Jeśli nie znaleziono linków, zwróć podstawowe zasoby
            if (urls.length === 0) {
                return [
                    `Documentation for ${topic}`,
                    `Tutorial for ${topic}`,
                    `Best practices for ${topic}`
                ]
            }

            return urls
        } catch (error) {
            console.error('Error searching resources:', error)
            // W przypadku błędu zwróć podstawowe zasoby
            return [
                `Documentation for ${topic}`,
                `Tutorial for ${topic}`,
                `Best practices for ${topic}`
            ]
        }
    }
}