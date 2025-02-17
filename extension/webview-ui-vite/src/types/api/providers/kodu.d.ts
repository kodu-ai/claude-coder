import { ApiConstructorOptions, ApiHandler } from "..";
import { koduSSEResponse } from "../../shared/kodu";
import { ModelInfo } from "./types";
export declare function fetchKoduUser({ apiKey }: {
    apiKey: string;
}): Promise<{
    credits: number;
    id: string;
    email: string;
    isVisitor: boolean;
} | null>;
export declare class KoduHandler implements ApiHandler {
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
