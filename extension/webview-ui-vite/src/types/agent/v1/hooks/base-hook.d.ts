import { MainAgent } from "../main-agent";
export interface HookOptions {
    /**
     * Number of requests before triggering the hook
     */
    triggerEvery?: number;
    /**
     * Hook name
     */
    hookName: string;
}
export interface HookState {
    /**
     * Parent agent's task ID
     */
    taskId: string;
    /**
     * Hook name
     */
    hookName: string;
    /**
     * Counter for requests since last trigger
     */
    requestsSinceLastTrigger: number;
}
/**
 * Base class for implementing hooks that can inject content into requests
 */
export declare abstract class BaseHook {
    protected hookState: HookState;
    protected _hookOptions: HookOptions;
    protected koduDev: MainAgent;
    get hookOptions(): HookOptions;
    constructor(options: HookOptions, koduDev: MainAgent);
    /**
     * Check if the hook should be triggered
     */
    shouldTrigger(): boolean;
    updateOptions(options: Partial<HookOptions>): void;
    /**
     * Execute the hook and return content to inject
     */
    execute(): Promise<string | null>;
    /**
     * Abstract method to be implemented by specific hooks
     */
    protected abstract executeHook(): Promise<string | null>;
}
