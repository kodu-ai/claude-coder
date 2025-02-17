import { ExtensionProvider } from "../../providers/extension-provider";
import { ClaudeAskResponse } from "../../shared/messages/client-message";
import { ApiManager } from "../../api/api-handler";
import { ToolExecutor } from "./tools/tool-executor";
import { MainAgentOptions } from "./types";
import { StateManager } from "./state-manager";
import { AdvancedTerminalManager } from "../../integrations/terminal";
import { BrowserManager } from "./browser-manager";
import { GitHandler } from "./handlers";
import { TaskExecutor } from "./task-executor/task-executor";
import { HookManager, BaseHook, HookOptions, HookConstructor } from "./hooks";
export declare class MainAgent {
    private stateManager;
    private apiManager;
    private hookManager;
    toolExecutor: ToolExecutor;
    taskExecutor: TaskExecutor;
    /**
     * If the last api message caused a file edit
     */
    isLastMessageFileEdit: boolean;
    terminalManager: AdvancedTerminalManager;
    providerRef: WeakRef<ExtensionProvider>;
    browserManager: BrowserManager;
    isFirstMessage: boolean;
    private isAborting;
    gitHandler: GitHandler;
    constructor(options: MainAgentOptions & {
        noTask?: boolean;
    });
    getStateManager(): StateManager;
    getApiManager(): ApiManager;
    getHookManager(): HookManager;
    /**
     * Execute hooks and get injected content
     */
    executeHooks(): Promise<string | null>;
    /**
     * Register a new hook
     */
    registerHook<T extends BaseHook>(HookClass: HookConstructor<T>, options: HookOptions): T;
    /**
     * Remove a hook by name
     */
    removeHook(hookName: string): void;
    /**
     * Get a hook by name
     */
    getHook(hookName: string): BaseHook | undefined;
    private setupTaskExecutor;
    handleWebviewAskResponse(askResponse: ClaudeAskResponse, text?: string, images?: string[]): Promise<void>;
    startTask(task?: string, images?: string[]): Promise<void>;
    resumeTaskFromHistory(): Promise<void>;
    abortTask(): Promise<void>;
    observerHookEvery(value?: number): void;
    getEnvironmentDetails(includeFileDetails?: boolean): Promise<string>;
}
export * from "./types";
