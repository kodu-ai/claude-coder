import { MainAgent } from "../main-agent";
import { BaseHook, HookOptions } from "./base-hook";
/**
 * Options specific to the memory hook
 */
export interface ObserverHookOptions extends HookOptions {
}
export declare const observerHookDefaultPrompt: string;
/**
 * Hook that maintains and injects relevant memory context
 */
export declare class ObserverHook extends BaseHook {
    private options;
    constructor(options: ObserverHookOptions, koduDev: MainAgent);
    private shouldExecute;
    protected executeHook(): Promise<string | null>;
    /**
     * Get current context from state
     */
    private getCurrentContext;
    private getTaskText;
}
