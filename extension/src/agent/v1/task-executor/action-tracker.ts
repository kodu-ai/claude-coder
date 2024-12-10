import { ActionRecord, ReflectionParams, ReflectionResult } from "../types/reflection"
import { ToolName, ToolResponse } from "../types"
import { TaskExecutor } from "./task-executor"

interface ToolResponseWithStatus {
    toolName: string
    toolId: string
    status: 'success' | 'error' | 'feedback'
    text: string
    images?: string[]
}

function isToolResponseWithStatus(outcome: any): outcome is ToolResponseWithStatus {
    return (
        typeof outcome === 'object' &&
        outcome !== null &&
        'status' in outcome &&
        typeof outcome.status === 'string' &&
        ['success', 'error', 'feedback'].includes(outcome.status)
    )
}

export class ActionTracker {
    private actions: ActionRecord[] = []
    private lastReflectionTime: number = 0
    private readonly REFLECTION_COOLDOWN = 5 * 60 * 1000 // 5 minutes
    private readonly ACTION_THRESHOLD = 5 // Reflect after every 5 actions
    private readonly ERROR_THRESHOLD = 2 // Reflect after 2 errors

    constructor(private readonly taskExecutor: TaskExecutor) {}

    public async trackAction(
        toolName: ToolName,
        reasoning: string,
        params: Record<string, any>,
        outcome: ToolResponse,
        error?: string
    ): Promise<void> {
        const action: ActionRecord = {
            toolName,
            reasoning,
            params,
            outcome,
            timestamp: Date.now(),
            error
        }

        this.actions.push(action)

        // Check if we should trigger reflection
        await this.checkReflectionTriggers()
    }

    private async checkReflectionTriggers(): Promise<void> {
        const now = Date.now()
        const timeSinceLastReflection = now - this.lastReflectionTime

        // Don't reflect too frequently
        if (timeSinceLastReflection < this.REFLECTION_COOLDOWN) {
            return
        }

        // Count recent errors
        const recentErrors = this.actions
            .slice(-this.ERROR_THRESHOLD)
            .filter(action => {
                if (typeof action.outcome === 'string') {
                    return action.error !== undefined
                }
                return isToolResponseWithStatus(action.outcome) && 
                    (action.outcome.status === 'error' || action.error !== undefined)
            })

        const shouldReflect = 
            this.actions.length >= this.ACTION_THRESHOLD || // Reflect after N actions
            recentErrors.length >= this.ERROR_THRESHOLD    // Reflect after M errors

        if (shouldReflect) {
            await this.triggerReflection()
            this.lastReflectionTime = now
        }
    }

    private async triggerReflection(focus?: ReflectionParams['focus']): Promise<ReflectionResult | null> {
        if (this.actions.length === 0) {
            return null
        }

        const reflectionParams: ReflectionParams = {
            actions: this.actions,
            focus,
            limit: 10 // Look at last 10 actions by default
        }

        try {
            // Access the tool executor through the task executor's public method
            const result = await this.taskExecutor.executeReflection(reflectionParams)
            return result
        } catch (error) {
            console.error('Failed to perform reflection:', error)
            return null
        }
    }

    public async reflectBeforeCompletion(): Promise<ReflectionResult | null> {
        // Special reflection focused on overall task completion
        return this.triggerReflection('pattern-recognition')
    }

    public async reflectOnError(): Promise<ReflectionResult | null> {
        // Special reflection focused on error analysis
        return this.triggerReflection('error-analysis')
    }

    public getActions(): ActionRecord[] {
        return [...this.actions]
    }

    public clear(): void {
        this.actions = []
        this.lastReflectionTime = 0
    }
}