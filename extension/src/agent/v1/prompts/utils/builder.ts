import dedent from "dedent"
import {
	PromptConfig,
	Section,
	ToolPromptSchema,
	TemplatePlaceholder,
	ValidTemplateString,
	ToolParameter,
	ToolExample,
	templatePlaceHolder,
} from "./types"
import { getCwd } from "../../utils"

export class PromptBuilder {
	private config: PromptConfig
	private capabilities: string[] = []
	private tools: ToolPromptSchema[] = []
	private sections: Section[] = []

	constructor(config: PromptConfig) {
		this.config = config
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
		this.validateTemplate(this.config.template)
	}

	// Validates that the template string contains only allowed placeholders
	private validateTemplate(template: string) {
		const placeholderRegex = /{{([^{}]+)}}/g // Updated regex
		let match
		while ((match = placeholderRegex.exec(template)) !== null) {
			const placeholder = match[1]
			if (
				!templatePlaceHolder.includes(placeholder as any) // Updated type assertion
			) {
				throw new Error(`Invalid placeholder found in template: {{${placeholder}}}`)
			}
		}
	}

	// Basic type checking for parameters
	private validateToolParameters(parameters: Record<string, ToolParameter>) {
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

	// Basic type checking for examples
	private validateToolExamples(examples: ToolExample[]) {
		for (const example of examples) {
			if (!example.description || !example.output) {
				throw new Error(`Invalid example definition`)
			}
		}
	}

	// Basic type checking for tool
	private validateTool(tool: ToolPromptSchema) {
		if (!tool.name || !tool.description || !tool.parameters || !tool.capabilities || !tool.examples) {
			throw new Error(`Invalid tool definition for ${tool.name}`)
		}

		this.validateToolParameters(tool.parameters)
		this.validateToolExamples(tool.examples)
	}

	addTools(tools: ToolPromptSchema[]) {
		tools.forEach((tool) => this.addTool(tool))
		return this
	}

	addTool(tool: ToolPromptSchema) {
		this.validateTool(tool)
		this.capabilities.push(...tool.capabilities)
		this.tools.push(tool)
		return this
	}

	addCapability(capability: string) {
		this.capabilities.push(capability)
		return this
	}

	// Add a section to a specific location in the template
	addSection(name: TemplatePlaceholder, content: string) {
		this.sections.push({ name, content })
		return this
	}

	// Generate the content for a given section name
	private generateSectionContent(sectionName: TemplatePlaceholder): string {
		switch (sectionName) {
			case "tools":
				return this.tools.join("\n")
			case "capabilities":
				return this.capabilities.join("\n")
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
			default:
				return ""
		}
	}

	// Build the final prompt
	build(): string {
		const { agentName, osName, defaultShell, homeDir, template } = this.config

		// Replace placeholders in the template with section content or other data
		let populatedTemplate = template
			.replace("{{agentName}}", agentName)
			.replace("{{osName}}", osName)
			.replace("{{defaultShell}}", defaultShell)
			.replace("{{homeDir}}", homeDir)
			.replace("{{cwd}}", getCwd().toPosix().replace(/\\/g, "/"))

		// Replace placeholders for tools, rules, and capabilities
		populatedTemplate = populatedTemplate.replace("{{toolSection}}", this.generateSectionContent("toolSection"))
		populatedTemplate = populatedTemplate.replace(
			"{{capabilitiesSection}}",
			this.generateSectionContent("capabilitiesSection")
		)
		populatedTemplate = populatedTemplate.replace("{{rulesSection}}", this.generateSectionContent("rulesSection"))

		// Add custom sections
		this.sections.forEach((section) => {
			populatedTemplate = populatedTemplate.replace(`{{${section.name}}}`, section.content)
		})

		return populatedTemplate
	}
}
