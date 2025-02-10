import { ClaudeMessage } from "./messages/extension-message";
interface ApiMetrics {
    totalTokensIn: number;
    totalTokensOut: number;
    totalCacheWrites?: number;
    totalCacheReads?: number;
    totalCost: number;
}
export declare function getApiMetrics(messages: ClaudeMessage[]): ApiMetrics;
export {};
