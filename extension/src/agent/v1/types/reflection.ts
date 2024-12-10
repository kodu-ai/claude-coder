import { ToolName } from "../../../shared/Tool"
import { ToolResponse } from "../types"

/**
 * Represents a single action taken by the AI
 */
export interface ActionRecord {
    /** The tool that was used */
    toolName: ToolName
    /** The reasoning behind using this tool */
    reasoning: string
    /** The parameters passed to the tool */
    params: Record<string, any>
    /** The outcome/response from the tool */
    outcome: ToolResponse
    /** When this action was taken */
    timestamp: number
    /** Any errors that occurred */
    error?: string
}

/**
 * The result of a reflection analysis
 */
export interface ReflectionResult {
    /** Patterns observed in the action sequence */
    patterns: string[]
    /** What worked well */
    successes: string[]
    /** What could be improved */
    improvements: string[]
    /** Suggested strategy adjustments */
    adjustments: string[]
    /** Overall reflection summary */
    summary: string
}

/**
 * Parameters for the reflection tool
 */
export interface ReflectionParams {
    /** Actions to analyze */
    actions: ActionRecord[]
    /** Optional focus area for reflection */
    focus?: 'error-analysis' | 'strategy-optimization' | 'pattern-recognition'
    /** Number of recent actions to analyze, defaults to all */
    limit?: number
}

/**
 * Configuration for when reflection should be triggered
 */
export interface ReflectionConfig {
    /** Trigger reflection after this many actions */
    actionThreshold: number
    /** Trigger reflection after this many errors */
    errorThreshold: number
    /** Minimum time between reflections (ms) */
    cooldownPeriod: number
    /** Whether to reflect after task completion */
    reflectOnCompletion: boolean
}