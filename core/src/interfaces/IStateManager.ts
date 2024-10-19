import { State, ClaudeMessage, ApiConversationHistoryItem } from '../types/state';

export interface IStateManager {
    /**
     * Set the state of the application
     * @param newState Partial state to be merged with the current state
     */
    setState(newState: Partial<State>): void;

    /**
     * Get the current state of the application
     * @returns The current state
     */
    getState(): State;

    /**
     * Retrieve saved Claude messages
     * @returns Promise resolving to an array of ClaudeMessage
     */
    getSavedClaudeMessages(): Promise<ClaudeMessage[]>;

    /**
     * Overwrite existing Claude messages with new ones
     * @param messages Array of ClaudeMessage to replace existing messages
     */
    overwriteClaudeMessages(messages: ClaudeMessage[]): Promise<void>;

    /**
     * Retrieve saved API conversation history
     * @returns Promise resolving to an array of ApiConversationHistoryItem
     */
    getSavedApiConversationHistory(): Promise<ApiConversationHistoryItem[]>;

    /**
     * Overwrite existing API conversation history with new items
     * @param history Array of ApiConversationHistoryItem to replace existing history
     */
    overwriteApiConversationHistory(history: ApiConversationHistoryItem[]): Promise<void>;
}