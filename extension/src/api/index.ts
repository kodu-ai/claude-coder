import { Anthropic } from "@anthropic-ai/sdk"
import { ApiModelId, KoduModelId, ModelInfo } from "../shared/api"
import { KoduHandler } from "./kodu"
import { AskConsultantResponseDto, SummaryResponseDto, WebSearchResponseDto } from "./interfaces"
import { z } from "zod"
import { koduSSEResponse } from "../shared/kodu"

export interface ApiHandlerMessageResponse {
	message: Anthropic.Messages.Message | Anthropic.Beta.PromptCaching.Messages.PromptCachingBetaMessage
	userCredits?: number
	errorString?: string
	errorCode?: number
}

export type ApiConfiguration = {
	koduApiKey?: string
	apiModelId?: KoduModelId
}
export const bugReportSchema = z.object({
	description: z.string(),
	reproduction: z.string(),
	apiHistory: z.string(),
	claudeMessage: z.string(),
})
export interface ApiHandler {
	createMessageStream(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		creativeMode?: "normal" | "creative" | "deterministic",
		abortSignal?: AbortSignal | null,
		customInstructions?: string,
		userMemory?: string,
		EnvironmentDetails?: string
	): AsyncIterableIterator<koduSSEResponse>

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

	sendAskConsultantRequest?(query: string): Promise<AskConsultantResponseDto>

	sendSummarizeRequest?(text: string, command: string): Promise<SummaryResponseDto>

	sendBugReportRequest?(params: z.infer<typeof bugReportSchema>): Promise<void>
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
