import { IStateManager } from '@/interfaces';
import { State } from '@/types';

export abstract class BaseStateManager implements IStateManager {
    protected state: State;

    constructor(initialState: State) {
        this.state = initialState;
    }

    abstract setState(newState: Partial<State>): void;
    abstract getState(): State;
    abstract getSavedClaudeMessages(): Promise<any[]>;
    abstract overwriteClaudeMessages(messages: any[]): Promise<void>;
    abstract getSavedApiConversationHistory(): Promise<any[]>;
    abstract overwriteApiConversationHistory(history: any[]): Promise<void>;

    // Common methods that can be shared across implementations
    protected mergeState(newState: Partial<State>): State {
        return { ...this.state, ...newState };
    }

    protected validateState(state: State): boolean {
        // Implement basic state validation logic
        return (
            typeof state.taskId === 'string' &&
            typeof state.dirAbsolutePath === 'string' &&
            typeof state.isRepoInitialized === 'boolean' &&
            typeof state.requestCount === 'number' &&
            Array.isArray(state.apiConversationHistory) &&
            Array.isArray(state.claudeMessages)
        );
    }
}