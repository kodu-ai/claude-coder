import { MainAgent } from "../main-agent";
import { BaseHook, HookOptions } from "./base-hook";
/**
 * Manages the lifecycle and execution of hooks
 */
export declare class HookManager {
    private hooks;
    private koduDev;
    constructor(koduDev: MainAgent);
    /**
     * Register a new hook
     */
    registerHook<T extends BaseHook>(HookClass: new (options: HookOptions, koduDev: MainAgent) => T, options: HookOptions): T;
    /**
     * Update hook settings
     */
    updateHook(hookName: string, options: Partial<HookOptions>): void;
    /**
     * Check all hooks and execute those that should be triggered
     * Returns concatenated content from all triggered hooks
     */
    checkAndExecuteHooks(): Promise<string | null>;
    /**
     * Remove a hook from the manager
     */
    removeHook(hookName: string): void;
    /**
     * Get a hook by name
     */
    getHook(hookName: string): BaseHook | undefined;
    /**
     * Check if a hook exists
     */
    hasHook(hookName: string): boolean;
    /**
     * Get all registered hooks
     */
    getHooks(): BaseHook[];
    /**
     * Clear all hooks
     */
    clearHooks(): void;
}
