import { ExtensionProvider } from "../../../providers/extension-provider";
import { StateManager } from "../state-manager";
import { ToolExecutor } from "../tools/tool-executor";
import { UserContent } from "../types";
import { TaskExecutorUtils, TaskState } from "./utils";
export declare class TaskExecutor extends TaskExecutorUtils {
    state: TaskState;
    private toolExecutor;
    private currentUserContent;
    private isRequestCancelled;
    private _abortController;
    private consecutiveErrorCount;
    private isAborting;
    private streamPaused;
    private textBuffer;
    private _currentReplyId;
    private _currentStreamTs;
    private pauseNext;
    private lastResultWithCommit;
    constructor(stateManager: StateManager, toolExecutor: ToolExecutor, providerRef: WeakRef<ExtensionProvider>);
    get currentStreamTs(): number | null;
    get currentReplyId(): number | null;
    get abortController(): AbortController | null;
    protected getState(): TaskState;
    pauseStream(): Promise<void>;
    resumeStream(): Promise<void>;
    private flushTextBuffer;
    newMessage(message: UserContent): Promise<void>;
    startTask(userContent: UserContent): Promise<void>;
    resumeTask(userContent: UserContent): Promise<void>;
    private normalizeUserContent;
    abortTask(): Promise<void>;
    private cancelCurrentRequest;
    makeClaudeRequest(): Promise<void>;
    private processApiResponse;
    private resetState;
    pauseNextRequest(): void;
    private finishProcessingResponse;
    /**
     * pause the task from continuing
     */
    blockTask(): void;
    private handleApiError;
    /**
     * @description corrects the user content to prevent any issues with the API.
     * @param content the content that will be sent to API as a USER message in the AI conversation
     * @returns fixed user content format to prevent any issues with the API
     */
    private fixUserContent;
    private handleWaitingForUser;
}
