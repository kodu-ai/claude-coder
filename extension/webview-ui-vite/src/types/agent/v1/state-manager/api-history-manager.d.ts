import { KoduAgentState, ApiHistoryItem } from "../types";
import { IOManager } from "./io-manager";
interface ApiHistoryManagerOptions {
    state: KoduAgentState;
    ioManager: IOManager;
}
export declare class ApiHistoryManager {
    private state;
    private ioManager;
    constructor(options: ApiHistoryManagerOptions);
    getSavedApiConversationHistory(fromDisk?: boolean): Promise<ApiHistoryItem[]>;
    saveApiHistory(): Promise<void>;
    addToApiConversationHistory(message: ApiHistoryItem): Promise<number>;
    overwriteApiConversationHistory(newHistory: ApiHistoryItem[]): Promise<void>;
    deleteApiHistoryItem(messageId: number): Promise<void>;
    updateApiHistoryItem(messageId: number, message: ApiHistoryItem): Promise<void>;
}
export {};
