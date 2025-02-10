export type HistoryItem = {
    id: string;
    ts: number;
    task: string;
    tokensIn: number;
    tokensOut: number;
    cacheWrites?: number;
    cacheReads?: number;
    totalCost: number;
    name?: string;
    dirAbsolutePath?: string;
    isRepoInitialized?: boolean;
    currentTokens?: number;
    currentSubAgentId?: number;
    isCompleted?: boolean;
    manuallyMarkedCompletedAt?: number;
};
export declare const isSatifiesHistoryItem: (item: any) => item is HistoryItem;
