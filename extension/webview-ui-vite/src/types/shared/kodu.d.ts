import Anthropic from "@anthropic-ai/sdk";
export declare function getKoduSignInUrl(uriScheme?: string, extensionName?: string): string;
export declare function getKoduReferUrl(_uriScheme?: string): string;
export declare function getKoduOfferUrl(_uriScheme?: string): string;
export declare function getKoduAddCreditsUrl(_uriScheme?: string): string;
export declare function getKoduCurrentUser(): string;
export declare function getKoduVisitorUrl(): string;
export declare function getKoduInferenceUrl(): string;
export declare function getKoduBugReportUrl(): string;
export declare function getKoduSummarizeUrl(): string;
export declare function getKoduWebSearchUrl(): string;
export declare function getKoduScreenshotUrl(): string;
export declare function getKoduConsultantUrl(): string;
export declare function getKoduHomepageUrl(): string;
export declare enum KODU_ERROR_CODES {
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
    NETWORK_REFUSED_TO_CONNECT = 1
}
export declare const koduErrorMessages: Record<KODU_ERROR_CODES, string>;
export declare class KoduError extends Error {
    errorCode: KODU_ERROR_CODES;
    constructor({ code }: {
        code: number;
    });
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
export type koduSSEResponse = {
    code: 0;
    body: undefined;
} | {
    code: 1;
    body: {
        anthropic: Anthropic.Beta.PromptCaching.Messages.PromptCachingBetaMessage;
        internal: {
            cost: number;
            userCredits?: number;
            inputTokens: number;
            outputTokens: number;
            cacheCreationInputTokens: number;
            cacheReadInputTokens: number;
        };
    };
} | {
    code: 4;
    body: {
        /**
         * internal reasoning from the model (should not be saved to api history)
         */
        reasoningDelta: string;
    };
} | {
    code: 2;
    body: {
        /**
         * Text message received
         */
        text: string;
    };
} | {
    code: 3;
    body: {
        /**
         * Content block received
         */
        contentBlock: Anthropic.Messages.ContentBlock;
    };
} | {
    /**
     * Error response received
     */
    code: -1;
    body: {
        status: number | undefined;
        msg: string;
    };
};
