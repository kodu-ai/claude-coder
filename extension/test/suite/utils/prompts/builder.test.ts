import * as assert from "assert"
import { PromptBuilder } from "../../../../src/agent/v1/prompts/utils/builder"
import { PromptConfig, promptTemplate } from "../../../../src/agent/v1/prompts/utils/utils"
import { mainPrompts } from "../../../../src/agent/v1/prompts/main.prompt"

describe("PromptBuilder with Conditional Blocks", () => {
	const testTemplate = `
# Agent Configuration
Name: {{agentName}}
OS: {{osName}}

{{#vision}}
# Vision Capabilities
This agent can:
- Analyze images
- Extract text from images
{{#advanced}}
- Perform complex scene analysis
- Detect emotions in faces
{{/advanced}}
- Basic object detection
{{/vision}}

{{#vision}}
# Additional Vision Settings
- Resolution: High
{{#advanced}}
- Deep learning models enabled
- Neural processing active
{{/advanced}}
{{/vision}}

{{#coding}}
# Coding Capabilities
- Syntax highlighting
- Code completion
{{#advanced}}
- Refactoring suggestions
- Performance analysis
{{/advanced}}
{{/coding}}

# Tools
{{toolSection}}

{{#vision}}
Note: Vision processing enabled
{{#coding}}
With integrated code-vision analysis
{{/coding}}
{{/vision}}
`

	const baseConfig: PromptConfig = {
		agentName: "TestAgent",
		osName: "TestOS",
		defaultShell: "bash",
		homeDir: "/home/test",
		template: testTemplate,
		features: {
			vision: false,
			coding: false,
			advanced: false,
		},
	}

	it("should handle no features enabled", () => {
		const builder = new PromptBuilder(baseConfig)
		const result = builder.build()

		assert.ok(!result.includes("Vision Capabilities"))
		assert.ok(!result.includes("Coding Capabilities"))
		assert.ok(!result.includes("Advanced"))
	})

	it("should handle single feature enabled", () => {
		const config = {
			...baseConfig,
			features: { ...baseConfig.features, vision: true },
		}
		const builder = new PromptBuilder(config)
		const result = builder.build()

		assert.ok(result.includes("Vision Capabilities"))
		assert.ok(result.includes("Basic object detection"))
		assert.ok(!result.includes("Coding Capabilities"))
		assert.ok(!result.includes("Neural processing"))
	})

	it("should handle multiple features enabled", () => {
		const config = {
			...baseConfig,
			features: {
				vision: true,
				coding: true,
				advanced: false,
			},
		}
		const builder = new PromptBuilder(config)
		const result = builder.build()

		assert.ok(result.includes("Vision Capabilities"))
		assert.ok(result.includes("Coding Capabilities"))
		assert.ok(!result.includes("Neural processing"))
		assert.ok(result.includes("With integrated code-vision analysis"))
	})

	it("should handle nested blocks correctly", () => {
		const config = {
			...baseConfig,
			features: {
				vision: true,
				coding: true,
				advanced: true,
			},
		}
		const builder = new PromptBuilder(config)
		const result = builder.build()

		assert.ok(result.includes("Neural processing active"))
		assert.ok(result.includes("Refactoring suggestions"))
		assert.ok(result.includes("Perform complex scene analysis"))
	})

	it("should throw error on invalid block syntax", () => {
		const invalidTemplate = `
      {{#vision}}
      Something
      {{#advanced}}
      Nested
      {{/vision}}
      {{/advanced}}
    `

		assert.throws(() => {
			new PromptBuilder({
				...baseConfig,
				template: invalidTemplate,
			})
		}, Error)
	})
})
describe("promptTemplate", () => {
	it("main prompt should include vision block", () => {
		const mainTemplate = mainPrompts.template
		assert.ok(mainTemplate.includes("{{#vision}}"))
	})

	it("should create correct template with single block", () => {
		const template = promptTemplate(
			(b, helpers) => `
  # Agent Configuration
  Name: ${b.agentName}
  ${helpers.block("vision", `This agent can analyze images`)}
  `
		)

		assert.ok(template.includes("{{#vision}}"))
		assert.ok(template.includes("{{/vision}}"))
		assert.ok(template.includes("This agent can analyze images"))
	})

	it("should create correct template with nested blocks", () => {
		const template = promptTemplate(
			(b, helpers) => `
  ${helpers.block(
		"vision",
		`
  Basic vision
  ${helpers.block("advanced", `Advanced vision`)}
  `
  )}`
		)

		assert.ok(template.includes("{{#vision}}"))
		assert.ok(template.includes("{{/vision}}"))
		assert.ok(template.includes("{{#advanced}}"))
		assert.ok(template.includes("{{/advanced}}"))
		assert.ok(template.includes("Basic vision"))
		assert.ok(template.includes("Advanced vision"))

		// Test correct nesting
		const visionStart = template.indexOf("{{#vision}}")
		const advancedStart = template.indexOf("{{#advanced}}")
		const advancedEnd = template.indexOf("{{/advanced}}")
		const visionEnd = template.indexOf("{{/vision}}")

		assert.ok(visionStart < advancedStart)
		assert.ok(advancedStart < advancedEnd)
		assert.ok(advancedEnd < visionEnd)
	})

	it("should handle multiple blocks at same level", () => {
		const template = promptTemplate(
			(b, helpers) => `
  ${helpers.block("vision", `Vision content`)}
  ${helpers.block("coding", `Coding content`)}
  `
		)

		assert.ok(template.includes("{{#vision}}Vision content{{/vision}}"))
		assert.ok(template.includes("{{#coding}}Coding content{{/coding}}"))
	})

	it("should preserve placeholders in blocks", () => {
		const template = promptTemplate(
			(b, helpers) => `
  ${helpers.block(
		"vision",
		`
  Using ${b.agentName} for vision
  ${b.toolSection}
  `
  )}`
		)

		assert.ok(template.includes("{{agentName}}"))
		assert.ok(template.includes("{{toolSection}}"))
	})

	it("should allow complex nested structures", () => {
		const template = promptTemplate(
			(b, helpers) => `
  ${helpers.block(
		"vision",
		`
  Vision base
  ${helpers.block(
		"advanced",
		`
  Advanced vision with ${b.agentName}
  ${helpers.block("coding", `Coding in advanced vision`)}
  `
  )}
  Basic vision continue
  `
  )}`
		)

		const expectedStructure = [
			"{{#vision}}",
			"Vision base",
			"{{#advanced}}",
			"{{agentName}}",
			"{{#coding}}",
			"Coding in advanced vision",
			"{{/coding}}",
			"{{/advanced}}",
			"Basic vision continue",
			"{{/vision}}",
		]

		expectedStructure.forEach((part) => {
			assert.ok(template.includes(part), `Template should include ${part}`)
		})
	})
})
