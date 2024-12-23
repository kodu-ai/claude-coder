import osName from "os-name"
import { ToolName } from "../../tools/types"
import defaultShell from "default-shell"
import os from "os"
import { PromptBuilder } from "./builder"
import { GlobalStateManager } from "../../../../providers/state/global-state-manager"
import { toolPrompts } from "../tools"
import { templatePlaceHolder, ConditionalBlock } from "../../../../shared/agent/prompt"
import { ApiManager } from "../../../../providers/state/api-manager"

// Add these to types.ts
export interface TemplateValidationResult {
	isValid: boolean
	errors: string[]
	warnings: string[]
}

export interface TemplateProcessingOptions {
	preserveWhitespace?: boolean
	removeEmptyLines?: boolean
}

// Define the allowed placeholders in the template
export type TemplatePlaceholder = (typeof templatePlaceHolder)[number]

type ExtractPlaceholders<T extends string> =
	// First check for conditional blocks
	T extends `${infer Start}{{#${infer Block}}}${infer Content}{{/${infer EndBlock}}}${infer Rest}`
		? Block extends ConditionalBlock
			? EndBlock extends Block
				? ExtractPlaceholders<`${Start}${Content}${Rest}`>
				: never // Mismatched block tags
			: never // Invalid block type
		: // Then check for regular placeholders
		T extends `${infer _Start}{{${infer P}}}${infer Rest}`
		? P extends TemplatePlaceholder
			? ExtractPlaceholders<Rest>
			: never
		: T

// ValidTemplateString<T> will return `T` if all placeholders are valid, otherwise `never`.
export type ValidTemplateString<T extends string> = ExtractPlaceholders<T> extends never ? never : T

// Parameter definition
export interface ToolParameter {
	type: string
	description: string
	required: boolean | string
}

// Example definition
export interface ToolExample {
	description: string
	output: string
}

// Tool definition
export interface ToolPromptSchema {
	name: ToolName
	description: string
	parameters: Record<string, ToolParameter>
	extraDescriptions?: string
	capabilities: string[]
	examples: ToolExample[]
	requiresFeatures?: ConditionalBlock[]
}

// Section type
export interface Section {
	name: TemplatePlaceholder
	content: string
}

// Configuration for the PromptBuilder
export interface PromptConfig {
	task?: string
	agentName: string
	osName: string
	defaultShell: string
	homeDir: string
	template: ValidTemplateString<string>
	features?: {
		[K in ConditionalBlock]?: boolean
	}
}

// Updated promptTemplate function
export function promptTemplate(
	fn: (
		b: Record<TemplatePlaceholder, string>,
		helpers: {
			block: (type: ConditionalBlock, content: string) => string
		}
	) => string
): string {
	const builder = Object.fromEntries(templatePlaceHolder.map((p) => [p, `{{${p}}}`])) as Record<
		TemplatePlaceholder,
		string
	>

	const helpers = {
		block: (type: ConditionalBlock, content: string) => {
			return `{{#${type}}}${content}{{/${type}}}` // Just returns the block syntax
		},
	}

	// Simply return the template string
	return fn(builder, helpers)
}

export async function buildPromptFromTemplate(template: string, task?: string): Promise<string> {
	const vision = ApiManager.getInstance().getCurrentModelInfo().supportsImages
	const config: PromptConfig = {
		agentName: "Kodu",
		osName: osName(),
		defaultShell: defaultShell,
		homeDir: os.homedir().replace(/\\/g, "/"),
		template: template,
		task,
		features: {
			vision,
		},
	}

	const builder = new PromptBuilder(config)
	const disabledTools = GlobalStateManager.getInstance().getGlobalState("disabledTools") ?? []
	const filteredTools = toolPrompts.filter((tool) => !disabledTools.includes(tool.name))
	builder.addTools(filteredTools)

	const systemPrompt = builder.build()
	return systemPrompt
}
