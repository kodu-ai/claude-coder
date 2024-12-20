// Import values (classes)
import { BaseHook } from "./base-hook"
import { HookManager } from "./hook-manager"

// Import types
import type { HookOptions, HookState } from "./base-hook"
import { KoduDev } from ".."

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

// Hook type for type safety when registering hooks
export type HookConstructor<T extends BaseHook> = new (options: HookOptions, koduDev: KoduDev) => T

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
