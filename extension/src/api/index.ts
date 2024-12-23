import { Anthropic } from "@anthropic-ai/sdk"
import { ApiHandlerOptions, ApiModelId, KoduModelId, ModelInfo } from "../shared/api"
import { KoduHandler } from "./providers/kodu"
import { AskConsultantResponseDto, SummaryResponseDto, WebSearchResponseDto } from "./interfaces"
import { z } from "zod"
import { koduSSEResponse } from "../shared/kodu"
import { ApiHistoryItem } from "../agent/v1"

export interface ApiHandlerMessageResponse {
	message: Anthropic.Messages.Message | Anthropic.Beta.PromptCaching.Messages.PromptCachingBetaMessage
	userCredits?: number
	errorString?: string
	errorCode?: number
}

export type ApiConfiguration = {
	koduApiKey?: string
	apiModelId?: KoduModelId
	browserModelId?: string
}

export interface ApiHandler {
	createMessageStream({
		systemPrompt,
		messages,
		abortSignal,
		top_p,
		tempature,
		modelId,
		appendAfterCacheToLastMessage,
		updateAfterCacheInserts,
	}: {
		systemPrompt: string[]
		messages: ApiHistoryItem[]
		abortSignal: AbortSignal | null
		top_p?: number
		tempature?: number
		modelId: KoduModelId
		appendAfterCacheToLastMessage?: (lastMessage: Anthropic.Messages.Message) => void
		updateAfterCacheInserts?: (
			messages: ApiHistoryItem[],
			systemMessages: Anthropic.Beta.PromptCaching.Messages.PromptCachingBetaTextBlockParam[]
		) => Promise<[ApiHistoryItem[], Anthropic.Beta.PromptCaching.Messages.PromptCachingBetaTextBlockParam[]]>
	}): AsyncIterableIterator<koduSSEResponse>

	get options(): ApiHandlerOptions

	get cheapModelId(): string | undefined

	getModel(): { id: ApiModelId; info: ModelInfo }

	abortRequest(): void

	sendWebSearchRequest?(
		searchQuery: string,
		baseLink?: string,
		browserModel?: string,
		browserMode?: string,
		abortSignal?: AbortSignal
	): AsyncIterable<WebSearchResponseDto>
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
