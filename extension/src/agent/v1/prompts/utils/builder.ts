import dedent from "dedent"
import { getCwd } from "../../utils"
import {
	PromptConfig,
	Section,
	ToolPromptSchema,
	TemplatePlaceholder,
	TemplateValidationResult,
	TemplateProcessingOptions,
} from "./utils"
import { ConditionalBlock, conditionalBlocks, templatePlaceHolder } from "../../../../shared/agent/prompt"

function processConditionalBlocks(template: string, features: Record<ConditionalBlock, boolean>): string {
	let processed = template
	let previousProcessed: string

	// Keep processing until no more changes are made (handles nested blocks)
	do {
		previousProcessed = processed
		processed = processed.replace(/{{#(\w+)}}([\s\S]*?){{\/\1}}/g, (match, block, content) => {
			if (conditionalBlocks.includes(block as ConditionalBlock)) {
				return features[block as ConditionalBlock] ? content : ""
			}
			return match
		})
	} while (processed !== previousProcessed)

	return processed
}

function validateTemplateStructure(template: string): TemplateValidationResult {
	const result: TemplateValidationResult = {
		isValid: true,
		errors: [],
		warnings: [],
	}

	// Validate block structure
	const blockStack: string[] = []
	const blockRegex = /{{[/#](\w+)}}/g
	let match: RegExpExecArray | null

	while ((match = blockRegex.exec(template)) !== null) {
		const [full, block] = match

		if (full.startsWith("{{#")) {
			if (!conditionalBlocks.includes(block as ConditionalBlock)) {
				result.errors.push(`Unknown conditional block type: ${block}`)
			}
			blockStack.push(block)
		} else if (full.startsWith("{{/")) {
			const lastBlock = blockStack.pop()
			if (lastBlock !== block) {
				result.errors.push(`Mismatched block tags: expected {{/${lastBlock}}}, found {{/${block}}}`)
			}
		}
	}

	if (blockStack.length > 0) {
		result.errors.push(`Unclosed conditional blocks: ${blockStack.join(", ")}`)
	}

	return result
}

export class PromptBuilder {
	private config: PromptConfig
	private capabilities: string[] = []
	private tools: ToolPromptSchema[] = []
	private sections: Section[] = []

	constructor(config: PromptConfig) {
		this.config = {
			...config,
			features: {
				vision: false,
				...config.features,
			},
		}
		this.validateConfig()
	}

	private validateConfig() {
		if (
			!this.config.agentName ||
			!this.config.osName ||
			!this.config.defaultShell ||
			!this.config.homeDir ||
			!this.config.template
		) {
			throw new Error("Invalid PromptBuilder configuration: Missing required fields")
		}

		const validationResult = validateTemplateStructure(this.config.template)
		if (!validationResult.isValid || validationResult.errors.length > 0) {
			throw new Error(`Invalid template structure: ${validationResult.errors.join("; ")}`)
		}

		this.validateTemplate(this.config.template)
	}

	private validateTemplate(template: string) {
		// Validate regular placeholders
		const placeholderRegex = /{{([^{}]+)}}/g
		let match

		while ((match = placeholderRegex.exec(template)) !== null) {
			const placeholder = match[1]
			// Skip conditional blocks
			if (placeholder.startsWith("#") || placeholder.startsWith("/")) {
				continue
			}
			if (!templatePlaceHolder.includes(placeholder as TemplatePlaceholder)) {
				throw new Error(`Invalid placeholder found in template: {{${placeholder}}}`)
			}
		}
	}

	private validateToolParameters(parameters: Record<string, any>) {
		for (const paramName in parameters) {
			const param = parameters[paramName]
			if (
				!param.type ||
				!param.description ||
				!(typeof param.required === "boolean" || typeof param.required === "string")
			) {
				throw new Error(`Invalid parameter definition for ${paramName}`)
			}
		}
	}

	private validateToolExamples(examples: any[]) {
		for (const example of examples) {
			if (!example.description || !example.output) {
				throw new Error("Invalid example definition")
			}
		}
	}

	private validateTool(tool: ToolPromptSchema) {
		if (!tool.name || !tool.description || !tool.parameters || !tool.capabilities || !tool.examples) {
			throw new Error(`Invalid tool definition for ${tool.name}`)
		}

		this.validateToolParameters(tool.parameters)
		this.validateToolExamples(tool.examples)
	}

	private validateToolConditionalBlock(tool: ToolPromptSchema) {
		if (tool.requiresFeatures) {
			// checks if the required features are present in the config
			for (const feature of tool.requiresFeatures) {
				if (!this.config?.features?.[feature]) {
					return false
				}
			}
		}
		return true
	}

	addTools(tools: ToolPromptSchema[]) {
		tools.forEach((tool) => this.addTool(tool))
		return this
	}

	addTool(tool: ToolPromptSchema) {
		this.validateTool(tool)
		if (!this.validateToolConditionalBlock(tool)) {
			return this
		}
		this.capabilities.push(...tool.capabilities)
		this.tools.push(tool)
		return this
	}

	addCapability(capability: string) {
		this.capabilities.push(capability)
		return this
	}

	addSection(name: TemplatePlaceholder, content: string) {
		this.sections.push({ name, content })
		return this
	}

	private generateSectionContent(sectionName: TemplatePlaceholder): string {
		switch (sectionName) {
			case "toolSection":
				return this.tools
					.map(
						(tool) => dedent`
# ${tool.name}

Description: ${tool.description}

${
	Object.keys(tool.parameters).length > 0
		? `Parameters:
${Object.entries(tool.parameters)
	.map(
		([name, param]) =>
			`- ${name}: (${
				typeof param.required === "boolean" ? (param.required ? "required" : "optional") : param.required
			}) ${param.description}`
	)
	.join("\n")}`
		: ""
}
${tool.extraDescriptions ? `\n${tool.extraDescriptions}` : ""}

${
	tool.examples.length > 0
		? `## Examples:

${tool.examples
	.map(
		(example) => `### ${example.description}
> ${this.config.agentName} Output
${example.output}`
	)
	.join("\n\n")}`
		: ""
}
`
					)
					.join("\n")

			case "capabilitiesSection":
				return this.capabilities.map((cap) => `- ${cap}`).join("\n")

			case "rulesSection":
				return ""

			default:
				return ""
		}
	}

	private processTemplate(template: string, options: TemplateProcessingOptions = {}): string {
		let processed = template

		// Replace regular placeholders
		processed = processed
			.replace("{{agentName}}", this.config.agentName)
			.replace("{{osName}}", this.config.osName)
			.replace("{{defaultShell}}", this.config.defaultShell)
			.replace("{{homeDir}}", this.config.homeDir)
			.replace("{{cwd}}", getCwd().toPosix().replace(/\\/g, "/"))

		// Replace section placeholders
		processed = processed
			.replace("{{toolSection}}", this.generateSectionContent("toolSection"))
			.replace("{{capabilitiesSection}}", this.generateSectionContent("capabilitiesSection"))
			.replace("{{rulesSection}}", this.generateSectionContent("rulesSection"))

		// Replace custom sections
		this.sections.forEach((section) => {
			processed = processed.replace(`{{${section.name}}}`, section.content)
		})

		// Process conditional blocks
		processed = processConditionalBlocks(processed, this.config.features as Record<ConditionalBlock, boolean>)

		// Post-processing
		if (options.removeEmptyLines) {
			processed = processed.replace(/^\s*$(?:\r\n?|\n)/gm, "")
		}

		return processed
	}

	build(options: TemplateProcessingOptions = {}): string {
		return this.processTemplate(this.config.template, options)
	}

	// Helper method to get current features
	getFeatures(): Record<ConditionalBlock, boolean> {
		return this.config.features as Record<ConditionalBlock, boolean>
	}

	// Helper method to update features
	setFeatures(features: Partial<Record<ConditionalBlock, boolean>>) {
		this.config.features = {
			...this.config.features,
			...features,
		}
		return this
	}
}
