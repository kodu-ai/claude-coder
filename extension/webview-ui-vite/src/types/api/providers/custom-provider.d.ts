import { ApiConstructorOptions, ApiHandler } from "..";
import { koduSSEResponse } from "../../shared/kodu";
import { ModelInfo } from "./types";
export declare class CustomProviderError extends Error {
    private _providerId;
    private _modelId;
    constructor(message: string, providerId: string, modelId: string);
    get providerId(): string;
    get modelId(): string;
}
export declare class CustomApiHandler implements ApiHandler {
    private _options;
    private abortController;
    get options(): ApiConstructorOptions;
    constructor(options: ApiConstructorOptions);
    abortRequest(): Promise<void>;
    createMessageStream({ messages, systemPrompt, top_p, tempature, abortSignal, modelId, appendAfterCacheToLastMessage, updateAfterCacheInserts, }: Parameters<ApiHandler["createMessageStream"]>[0]): AsyncIterableIterator<koduSSEResponse>;
    getModel(): {
        id: string;
        info: ModelInfo;
    };
}
