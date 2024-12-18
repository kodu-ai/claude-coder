// Import values (classes)
import { BaseHook } from "./base-hook"
import { HookManager } from "./hook-manager"
import { MemoryHook } from "./memory-hook"

// Import types
import type { HookOptions, HookState } from "./base-hook"
import type { MemoryHookOptions } from "./memory-hook"

/**
 * Base hook types and classes for implementing custom hooks
 */
export { BaseHook }
export type { HookOptions }
export type { HookState }

/**
 * Hook manager for registering and managing hooks
 */
export { HookManager }

/**
 * Built-in hooks:
 *
 * DiagnosticHook - Injects diagnostic information about the codebase
 * MemoryHook - Maintains and injects relevant context from previous interactions
 */
export { MemoryHook }
export type { MemoryHookOptions }

// Hook type for type safety when registering hooks
export type HookConstructor<T extends BaseHook> = new (options: HookOptions, koduDev: any) => T

// Hook registration helper type
export type RegisteredHook = {
	name: string
	hook: BaseHook
}

/**
 * Example usage:
 *
 * ```typescript
 * const hookManager = new HookManager(koduDev)
 *
 * // Register diagnostic hook
 * hookManager.registerHook(DiagnosticHook, {
 *     hookName: 'diagnostics',
 *     hookPrompt: 'Monitor and inject diagnostic information',
 *     triggerEvery: 5,
 *     monitoredFiles: ['src/**\/*.ts']
 * })
 *
 * // Register memory hook
 * hookManager.registerHook(MemoryHook, {
 *     hookName: 'memory',
 *     hookPrompt: 'Maintain and inject relevant context',
 *     triggerEvery: 3,
 *     maxMemories: 10,
 *     relevanceThreshold: 0.7
 * })
 * ```
 */
