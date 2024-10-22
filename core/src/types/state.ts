import { Anthropic } from "@anthropic-ai/sdk";
import { ClaudeMessage } from "./messages";

export interface State {
    taskId: string;
    dirAbsolutePath: string;
    isRepoInitialized: boolean;
    requestCount: number;
    apiConversationHistory: Anthropic.Messages.MessageParam[];
    claudeMessages: ClaudeMessage[];
    abort: boolean;
    isHistoryItem?: boolean;
}

export type ApiConversationHistoryItem = Anthropic.Messages.MessageParam;

// If KoduState is different from State, define it here
// Otherwise, you can use State as KoduState
export type KoduState = State;