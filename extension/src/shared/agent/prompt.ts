// Define conditional blocks
export const conditionalBlocks = ["vision"] as const
export const templatePlaceHolder = [
	"agentName",
	"osName",
	"defaultShell",
	"homeDir",
	"cwd",
	"toolSection",
	"capabilitiesSection",
	"rulesSection",
	"task",
] as const

const placeHolderNames = [...templatePlaceHolder, ...conditionalBlocks] as const

export type PlaceHolderName = (typeof placeHolderNames)[number]

export type ConditionalBlock = (typeof conditionalBlocks)[number]
export interface TemplateInfo {
	name: string
	isActive: boolean
}
export interface TemplatePlaceholder {
	description: string
}

export interface TemplateHighlighterProps {
	text: string
	scrollTop: number
}

export const TEMPLATE_PLACEHOLDERS: Record<PlaceHolderName, TemplatePlaceholder> = {
	vision: {
		description: "Insert a vision block for image analysis capabilities",
	},
	agentName: {
		description: "The name of the AI assistant being configured",
	},
	osName: {
		description: "The operating system the agent is running on (e.g., Windows, Linux, macOS)",
	},
	defaultShell: {
		description: "The default shell used by the system (e.g., bash, powershell)",
	},
	homeDir: {
		description: "User's home directory path",
	},
	cwd: {
		description: "Current working directory path",
	},
	toolSection: {
		description: "Section containing all available tool definitions",
	},
	capabilitiesSection: {
		description: "Section listing all agent capabilities",
	},
	rulesSection: {
		description: "Section containing all agent rules",
	},
	task: {
		description: "The task the agent is currently performing",
	},
}

export const editorVariable = `^(${Object.keys(TEMPLATE_PLACEHOLDERS).join("|")})\\}}`

export const PLACEHOLDER_NAMES = Object.keys(TEMPLATE_PLACEHOLDERS)
