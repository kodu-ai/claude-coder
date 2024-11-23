import * as vscode from "vscode"
import { GlobalStateManager } from "./GlobalStateManager"

/**
 * Manages error states and ensures they are properly cleaned up
 */
export class ErrorStateManager {
    private static instance: ErrorStateManager
    private globalStateManager: GlobalStateManager
    private errorStates: Map<string, { timestamp: number; resolved: boolean }> = new Map()

    private constructor(context: vscode.ExtensionContext) {
        this.globalStateManager = GlobalStateManager.getInstance(context)
    }

    public static getInstance(context?: vscode.ExtensionContext): ErrorStateManager {
        if (!ErrorStateManager.instance) {
            if (!context) {
                throw new Error("Context must be provided when creating the ErrorStateManager instance")
            }
            ErrorStateManager.instance = new ErrorStateManager(context)
        }
        return ErrorStateManager.instance
    }

    /**
     * Records an error state for a specific file/task
     */
    public recordError(id: string, error: string) {
        this.errorStates.set(id, {
            timestamp: Date.now(),
            resolved: false
        })
    }

    /**
     * Marks an error as resolved
     */
    public resolveError(id: string) {
        const errorState = this.errorStates.get(id)
        if (errorState) {
            errorState.resolved = true
            this.errorStates.set(id, errorState)
        }
    }

    /**
     * Checks if a file/task has any unresolved errors
     */
    public hasUnresolvedErrors(id: string): boolean {
        const errorState = this.errorStates.get(id)
        return errorState ? !errorState.resolved : false
    }

    /**
     * Cleans up old error states
     */
    public cleanupErrorStates() {
        const now = Date.now()
        const CLEANUP_THRESHOLD = 30 * 60 * 1000 // 30 minutes

        for (const [id, state] of this.errorStates.entries()) {
            if (state.resolved || now - state.timestamp > CLEANUP_THRESHOLD) {
                this.errorStates.delete(id)
            }
        }
    }

    /**
     * Validates the current error state against the actual file/task state
     */
    public async validateErrorStates() {
        const taskHistory = await this.globalStateManager.getGlobalState("taskHistory") || []
        
        // Clean up error states for completed tasks
        for (const task of taskHistory) {
            if (task.completed && this.errorStates.has(task.id)) {
                this.resolveError(task.id)
            }
        }

        this.cleanupErrorStates()
    }

    /**
     * Resets all error states
     */
    public resetErrorStates() {
        this.errorStates.clear()
    }
}
