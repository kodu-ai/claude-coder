export const templatePlaceHolder = [
	"agentName",
	"osName",
	"defaultShell",
	"homeDir",
	"cwd",
	"toolSection",
	"capabilitiesSection",
	"rulesSection",
	"tools",
	"rules",
	"capabilities",
] as const

// Define the allowed placeholders in the template
export type TemplatePlaceholder = (typeof templatePlaceHolder)[number]

type ExtractPlaceholders<T extends string> =
	// Match a string that has `{{SomePlaceholder}}` in it.
	T extends `${infer _Start}{{${infer P}}}${infer Rest}`
		? // If `P` is one of our known placeholders, continue checking the remainder of the string `Rest`.
		  P extends TemplatePlaceholder
			? ExtractPlaceholders<Rest>
			: never // `P` was not a valid placeholder, so fail here.
		: // If no more placeholders are found, we're done.
		  T

// ValidTemplateString<T> will return `T` if all placeholders are valid, otherwise `never`.
export type ValidTemplateString<T extends string> = ExtractPlaceholders<T> extends never ? never : T

// Parameter definition
export interface ToolParameter {
	type: string
	description: string
	required: boolean | string // Now accepts a boolean or a string
}

// Example definition
export interface ToolExample {
	description: string
	output: string
}

// Tool definition
export interface ToolPromptSchema {
	name: string
	description: string
	parameters: Record<string, ToolParameter>
	extraDescriptions?: string
	capabilities: string[]
	examples: ToolExample[]
}

// Section type
export interface Section {
	name: TemplatePlaceholder
	content: string
}

// Configuration for the PromptBuilder
export interface PromptConfig {
	agentName: string
	osName: string
	defaultShell: string
	homeDir: string
	template: ValidTemplateString<string>
}

// Represent placeholders as properties on a builder object
type BuilderPlaceholders = {
	[P in TemplatePlaceholder]: `{{${P}}}`
}

// Updated promptTemplate function
export function promptTemplate(
	isVisionEnabled: boolean,
	fn: (b: Record<TemplatePlaceholder, string>, helpers: { supportsImages: (content: string) => string }) => string
): string {
	const builder = Object.fromEntries(templatePlaceHolder.map((p) => [p, `{{${p}}}`])) as Record<
		TemplatePlaceholder,
		string
	>

	const helpers = {
		supportsImages: (content: string) => {
			return isVisionEnabled ? content : ""
		},
	}

	return fn(builder, helpers)
}
