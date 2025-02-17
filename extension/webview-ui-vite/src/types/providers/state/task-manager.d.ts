import { Anthropic } from "@anthropic-ai/sdk";
import { HistoryItem } from "../../shared/history-item";
import { Resource } from "../../shared/messages/client-message";
import { ExtensionProvider } from "../extension-provider";
export declare class TaskManager {
    private provider;
    constructor(provider: ExtensionProvider);
    clearTask(): Promise<void>;
    handleNewTask(task?: string, images?: string[], attachements?: Resource[]): Promise<void>;
    handleAskResponse(askResponse: any, text?: string, images?: string[], attachements?: Resource[]): Promise<void>;
    renameTask(params: {
        isCurentTask: true;
        taskId?: undefined;
    } | {
        isCurentTask?: undefined;
        taskId: string;
    }): Promise<void>;
    selectImages(): Promise<string[]>;
    exportCurrentTask(): Promise<void>;
    showTaskWithId(id: string): Promise<void>;
    exportTaskWithId(id: string): Promise<void>;
    deleteTaskWithId(id: string): Promise<void>;
    restoreTaskFromDisk(): Promise<void>;
    clearAllTasks(): Promise<void>;
    getTaskWithId(id: string): Promise<{
        historyItem: HistoryItem;
        taskDirPath: string;
        apiConversationHistoryFilePath: string;
        claudeMessagesFilePath: string;
        apiConversationHistory: Anthropic.MessageParam[];
    }>;
    private deleteTaskFilesByTaskId;
    private deleteTaskFiles;
    markTaskAsCompleted(id: string, options?: {
        manual?: boolean;
    }): Promise<void>;
    markTasksAsCompleted(ids: string[]): Promise<void>;
    markTaskAsUncompleted(id: string): Promise<void>;
    migrateAllTasks(): Promise<void>;
    private deleteTaskFromState;
}
