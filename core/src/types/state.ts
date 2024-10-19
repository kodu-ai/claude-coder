import { Anthropic } from "@anthropic-ai/sdk";

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

export interface ClaudeMessage {
    // Define the structure of ClaudeMessage here
    // This is a placeholder, adjust according to your actual ClaudeMessage structure
    id: string;
    content: string;
    role: 'user' | 'assistant';
    timestamp: number;
}

export type ApiConversationHistoryItem = Anthropic.Messages.MessageParam;

// If KoduState is different from State, define it here
// Otherwise, you can use State as KoduState
export type KoduState = State;