import { Anthropic } from "@anthropic-ai/sdk"
import { ApiModelId, ModelInfo } from "../shared/api"
import { KoduHandler } from "./kodu"
import { WebSearchResponseDto } from "./interfaces"

export interface ApiHandlerMessageResponse {
	message: Anthropic.Messages.Message | Anthropic.Beta.PromptCaching.Messages.PromptCachingBetaMessage
	userCredits?: number
	errorString?: string
	errorCode?: number
}

export type ApiConfiguration = {
	koduApiKey?: string
	apiModelId?: ApiModelId
}

export interface ApiHandler {
	createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		tools: Anthropic.Messages.Tool[],
		creativeMode?: "normal" | "creative" | "deterministic",
		abortSignal?: AbortSignal | null,
		customInstructions?: string
	): Promise<ApiHandlerMessageResponse>

	createMessageStream?(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		tools: Anthropic.Messages.Tool[],
		creativeMode?: "normal" | "creative" | "deterministic",
		abortSignal?: AbortSignal | null
	): AsyncGenerator<ApiHandlerMessageResponse, void, unknown>

	createUserReadableRequest(
		userContent: Array<
			| Anthropic.TextBlockParam
			| Anthropic.ImageBlockParam
			| Anthropic.ToolUseBlockParam
			| Anthropic.ToolResultBlockParam
		>
	): any

	getModel(): { id: ApiModelId; info: ModelInfo }

	abortRequest(): void

	sendWebSearchRequest?(searchQuery: string, baseLink?: string): Promise<WebSearchResponseDto>
	sendUrlScreenshotRequest?(url: string): Promise<Blob>
}

export function buildApiHandler(configuration: ApiConfiguration): ApiHandler {
	return new KoduHandler({ koduApiKey: configuration.koduApiKey, apiModelId: configuration.apiModelId })
}

export function withoutImageData(
	userContent: Array<
		| Anthropic.TextBlockParam
		| Anthropic.ImageBlockParam
		| Anthropic.ToolUseBlockParam
		| Anthropic.ToolResultBlockParam
	>
): Array<
	Anthropic.TextBlockParam | Anthropic.ImageBlockParam | Anthropic.ToolUseBlockParam | Anthropic.ToolResultBlockParam
> {
	return userContent.map((part) => {
		if (part.type === "image") {
			return { ...part, source: { ...part.source, data: "..." } }
		} else if (part.type === "tool_result" && typeof part.content !== "string") {
			return {
				...part,
				content: part.content?.map((contentPart) => {
					if (contentPart.type === "image") {
						return { ...contentPart, source: { ...contentPart.source, data: "..." } }
					}
					return contentPart
				}),
			}
		}
		return part
	})
}
