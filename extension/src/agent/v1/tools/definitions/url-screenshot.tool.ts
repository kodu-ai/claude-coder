import { z } from "zod"
import { defineToolCallFormat, generateToolCallExamples } from "./tool-call-template"

/**
 * Unified definition for url_screenshot tool
 * Combines schema, prompt, and type definitions in one place
 * Uses consistent calling format
 */

/**
 * ZOD Schema Definition
 */
export const schema = z.object({
    url: z.string().describe("The URL provided by the user."),
})

/**
 * Type definitions derived from schema
 */
export type UrlScreenshotInput = z.infer<typeof schema>

export type UrlScreenshotToolParams = {
    name: "url_screenshot"
    input: UrlScreenshotInput
}

/**
 * Example parameter values for tool calls
 */
const exampleParams = [
    { url: "https://www.example.com" },
    { url: "https://www.companysite.com/about" },
    { url: "https://www.designinspiration.com/portfolio" }
]

/**
 * Generate consistent example tool calls
 */
const exampleCalls = generateToolCallExamples("url_screenshot", exampleParams)

/**
 * Prompt definition for LLM consumption
 * Based on prompts/tools/url-screenshot.ts but with unified calling format
 */
export const promptDefinition = {
    name: "url_screenshot",
    description: "Request to capture a screenshot and console logs of the initial state of a website. This tool navigates to the specified URL, takes a screenshot of the entire page as it appears immediately after loading, and collects any console logs or errors that occur during page load. It does not interact with the page or capture any state changes after the initial load.",
    parameters: {
        url: {
            type: "string",
            description: "The URL of the site to inspect. This should be a valid URL including the protocol (e.g. http://localhost:3000/page, file:///path/to/file.html, etc.)",
            required: true,
        },
    },
    capabilities: [
        "You can use the url_screenshot tool to capture a screenshot and console logs of the initial state of a website (including html files and locally running development servers) when you feel it is necessary in accomplishing the user's task. This tool may be useful at key stages of web development tasks-such as after implementing new features, making substantial changes, when troubleshooting issues, or to verify the result of your work. You can analyze the provided screenshot to ensure correct rendering or identify errors, and review console logs for runtime issues.\n	- For example, if asked to add a component to a react website, you might create the necessary files, run the site locally, then use url_screenshot to verify there are no runtime errors on page load."
    ],
    examples: exampleCalls.map((call, i) => ({
        description: `Screenshot website: ${exampleParams[i].url}`,
        output: call
    })),
    requiresFeatures: ["vision"],
    ...defineToolCallFormat("url_screenshot")
}

/**
 * Full tool definition - exports everything needed in one place
 */
export const urlScreenshotTool = {
    name: "url_screenshot",
    schema,
    prompt: promptDefinition,
    examples: promptDefinition.examples,
    callFormat: promptDefinition.callFormat
}