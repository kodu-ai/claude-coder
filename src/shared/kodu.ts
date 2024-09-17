import Anthropic from "@anthropic-ai/sdk"

const KODU_BASE_URL = "http://localhost:3000"
// const KODU_BASE_URL = "https://kodu.ai"

export function getKoduSignInUrl(uriScheme?: string, extensionName?: string) {
	console.log("uriScheme", uriScheme)
	console.log(`Extension name: ${extensionName}`)
	return `${KODU_BASE_URL}/auth/login?redirectTo=${uriScheme}://kodu-ai.${extensionName}&ext=1`
}

export function getKoduReferUrl(_uriScheme?: string) {
	return `${KODU_BASE_URL}/dashboard/referrals`
}

export function getKoduOfferUrl(_uriScheme?: string) {
	return `${KODU_BASE_URL}/dashboard/offerwall`
}

export function getKoduAddCreditsUrl(_uriScheme?: string) {
	return `${KODU_BASE_URL}/pricing`
}

export function getKoduCurrentUser() {
	return `${KODU_BASE_URL}/api/me`
}

export function getKoduVisitorUrl() {
	return `${KODU_BASE_URL}/api/extension/visitor`
}

export function getKoduInferenceUrl() {
	return `${KODU_BASE_URL}/api/inference-stream`
}

export function getKoduWebSearchUrl() {
	return `${KODU_BASE_URL}/api/tools/web-search`
}

export function getKoduHomepageUrl() {
	return `${KODU_BASE_URL}`
}

export enum KODU_ERROR_CODES {
	/**
	 * Invalid request error: There was an issue with the format or content of your request. We may also use this error type for other 4XX status codes not listed below.
	 */
	INVALID_REQUEST_ERROR = 400,
	/**
	 * Authentication error: There’s an issue with your API key.
	 */
	AUTHENTICATION_ERROR = 401,
	/**
	 * Payment required: Please add credits to your account.
	 */
	PAYMENT_REQUIRED = 402,
	/**
	 * Permission error: Your API key does not have permission to use the specified resource.
	 */
	PERMISSION_ERROR = 403,
	/**
	 * Not found error: The requested resource was not found.
	 */
	NOT_FOUND_ERROR = 404,
	/**
	 * Request too large: Request exceeds the maximum allowed number of bytes.
	 */
	REQUEST_TOO_LARGE = 413,
	/**
	 * Rate limit error: Your account has hit a rate limit.
	 */
	RATE_LIMIT_ERROR = 429,
	/**
	 * API error: An unexpected error has occurred internal to Anthropic’s systems.
	 */
	API_ERROR = 500,
	/**
	 * Overloaded error: Anthropic’s API is temporarily overloaded.
	 */
	OVERLOADED_ERROR = 529,
	/**
	 * Network refused to connect
	 */
	NETWORK_REFUSED_TO_CONNECT = 1,
}
export const koduErrorMessages: Record<KODU_ERROR_CODES, string> = {
	// 	400 - invalid_request_error: There was an issue with the format or content of your request. We may also use this error type for other 4XX status codes not listed below.
	// 401 - authentication_error: There’s an issue with your API key.
	// 403 - permission_error: Your API key does not have permission to use the specified resource.
	// 404 - not_found_error: The requested resource was not found.
	// 413 - request_too_large: Request exceeds the maximum allowed number of bytes.
	// 429 - rate_limit_error: Your account has hit a rate limit.
	// 500 - api_error: An unexpected error has occurred internal to Anthropic’s systems.
	// 529 - overloaded_error: Anthropic’s API is temporarily overloaded.
	400: "There was an issue with the format or content of your request.",
	401: "Unauthorized. please login again.",
	402: "Payment Required. Please add credits to your account.",
	403: "Your API key does not have permission to use the specified resource.",
	404: "The requested resource was not found.",
	413: "Request exceeds the maximum allowed number of bytes.",
	429: "Your account has hit a rate limit.",
	500: "An unexpected error has occurred internal to Anthropic’s systems.",
	529: "Anthropic’s API is temporarily overloaded.",
	// network refused to connect
	1: "Network refused to connect",
}

export class KoduError extends Error {
	constructor({ code }: { code: number }) {
		if (code in KODU_ERROR_CODES) {
			super(koduErrorMessages[code as KODU_ERROR_CODES])
		} else {
			super("Unknown error")
		}
		this.name = "KoduError"
	}
}

/** Kodu streaming ui example
 messageStream.on("error", (error) => {
    console.error(`Error in message stream`, error);
  });
  messageStream.on("text", (text) => {
    enqueue(`data: ${JSON.stringify({ code: 2, text })}\n\n`);
  });
  messageStream.on("contentBlock", (contentBlock) => {
    enqueue(`data: ${JSON.stringify({ code: 3, contentBlock })}\n\n`);
  });
 */

export type koduSSEResponse =
	| {
			code: 0
			body: undefined
	  }
	| {
			code: 1
			body: {
				anthropic: Anthropic.Beta.PromptCaching.Messages.PromptCachingBetaMessage
				internal: {
					cost: number
					userCredits: number
					inputTokens: number
					outputTokens: number
					cacheCreationInputTokens: number
					cacheReadInputTokens: number
				}
			}
	  }
	| {
			code: 2
			body: {
				/**
				 * Text message received
				 */
				text: string
			}
	  }
	| {
			code: 3
			body: {
				/**
				 * Content block received
				 */
				contentBlock: Anthropic.Messages.ContentBlock
			}
	  }
	| {
			/**
			 * Error response received
			 */
			code: -1
			body: {
				status: number | undefined
				msg: string
			}
	  }
