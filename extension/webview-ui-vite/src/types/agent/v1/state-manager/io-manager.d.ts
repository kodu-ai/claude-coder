import { ApiHistoryItem, Checkpoint, ClaudeMessage, FileVersion, SubAgentState } from "../types";
interface IOManagerOptions {
    fsPath: string;
    taskId: string;
    agentHash?: string;
}
/**
 * IOManager now handles all file I/O in the background using a queue.
 * It is responsible for:
 * - Ensuring directories exist
 * - Reading/writing Claude messages and API history
 * - Managing file versions I/O
 */
export declare class IOManager {
    private fsPath;
    private taskId;
    private _agentHash?;
    private writeQueue;
    private isFlushing;
    constructor(options: IOManagerOptions);
    get agentHash(): string | undefined;
    set agentHash(value: string | undefined);
    private ensureTaskDirectoryExists;
    private getSubAgentDirectory;
    saveSubAgentState(state: SubAgentState): Promise<void>;
    loadSubAgentState(): Promise<SubAgentState | undefined>;
    private getClaudeMessagesFilePath;
    private getApiHistoryFilePath;
    loadClaudeMessages(taskId?: string): Promise<ClaudeMessage[]>;
    saveClaudeMessages(messages: ClaudeMessage[]): Promise<void>;
    loadApiHistory(): Promise<ApiHistoryItem[]>;
    saveApiHistory(history: ApiHistoryItem[]): Promise<void>;
    private getFileVersionsDir;
    saveFileVersion(file: FileVersion): Promise<void>;
    deleteFileVersion(file: FileVersion): Promise<void>;
    getFileVersions(relPath: string): Promise<FileVersion[]>;
    getFilesInTaskDirectory(): Promise<Record<string, FileVersion[]>>;
    saveCheckpoint(checkpoint: Checkpoint): Promise<void>;
    loadCheckpoint(taskId: string): Promise<Checkpoint | undefined>;
    private encodeFilePath;
    private decodeFilePath;
    private enqueueWriteOperation;
    private flushQueue;
}
export {};
