import { KoduDev } from ".."
import { BaseHook, HookOptions } from "./base-hook"

/**
 * Options specific to the memory hook
 */
export interface MemoryHookOptions extends HookOptions {
	/**
	 * Maximum number of memories to maintain
	 */
	maxMemories?: number

	/**
	 * Minimum relevance score for injecting a memory
	 */
	relevanceThreshold?: number
}

interface Memory {
	content: string
	timestamp: number
	relevanceScore: number
	context: string
}

/**
 * Hook that maintains and injects relevant memory context
 */
export class MemoryHook extends BaseHook {
	private memories: Memory[] = []
	private options: MemoryHookOptions

	constructor(options: MemoryHookOptions, koduDev: KoduDev) {
		super(options, koduDev)
		this.options = {
			maxMemories: options.maxMemories ?? 10,
			relevanceThreshold: options.relevanceThreshold ?? 0.7,
			...options,
		}
	}

	/**
	 * Add a new memory with context
	 */
	public addMemory(content: string, context: string, relevanceScore: number = 1.0): void {
		this.memories.push({
			content,
			context,
			timestamp: Date.now(),
			relevanceScore,
		})

		// Keep only the most relevant and recent memories up to maxMemories
		if (this.memories.length > this.options.maxMemories!) {
			this.memories = this.memories
				.sort((a, b) => {
					// Sort by relevance first, then by timestamp
					if (a.relevanceScore !== b.relevanceScore) {
						return b.relevanceScore - a.relevanceScore
					}
					return b.timestamp - a.timestamp
				})
				.slice(0, this.options.maxMemories)
		}
	}

	protected async executeHook(): Promise<string | null> {
		try {
			// Get current context from state
			const currentContext = this.getCurrentContext()

			// Update memory relevance scores based on current context
			this.updateRelevanceScores(currentContext)

			// Get relevant memories
			const relevantMemories = this.memories.filter(
				(memory) => memory.relevanceScore >= this.options.relevanceThreshold!
			)

			if (relevantMemories.length === 0) {
				return null
			}

			// Format memories for injection
			const formattedMemories = relevantMemories
				.sort((a, b) => b.relevanceScore - a.relevanceScore)
				.map((memory) => {
					return `Context: ${memory.context}\nMemory: ${memory.content}`
				})
				.join("\n\n")

			return `
<memory_context>
The following relevant context from previous interactions may be helpful:

${formattedMemories}

Please consider this context when processing the request.
</memory_context>
`
		} catch (error) {
			console.error("Failed to execute memory hook:", error)
			return null
		}
	}

	/**
	 * Get current context from state
	 */
	private getCurrentContext(): string {
		const state = this.koduDev.getStateManager().state
		const interestedFiles = state.interestedFiles?.map((f) => f.path).join(", ") || ""
		const taskId = state.taskId || ""

		return `Task: ${taskId}\nFiles: ${interestedFiles}`
	}

	/**
	 * Update memory relevance scores based on current context
	 */
	private updateRelevanceScores(currentContext: string): void {
		const interestedFiles = this.koduDev.getStateManager().state.interestedFiles || []

		this.memories.forEach((memory) => {
			// Base score on time decay
			const ageInHours = (Date.now() - memory.timestamp) / (1000 * 60 * 60)
			let score = Math.max(0, 1 - ageInHours / 24) // Decay over 24 hours

			// Boost score if memory context matches current files
			const memoryFiles =
				memory.context
					.split("\n")
					.find((line) => line.startsWith("Files:"))
					?.split(":")[1]
					.split(",")
					.map((f) => f.trim()) || []

			const matchingFiles = interestedFiles.filter((f) => memoryFiles.some((mf) => mf === f.path))

			if (matchingFiles.length > 0) {
				score += 0.3 * (matchingFiles.length / interestedFiles.length)
			}

			// Cap score at 1.0
			memory.relevanceScore = Math.min(1.0, score)
		})
	}
}
