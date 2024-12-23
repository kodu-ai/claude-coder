import { ToolPromptSchema } from "../utils/utils"

export const urlScreenshotPrompt: ToolPromptSchema = {
	name: "url_screenshot",
	description:
		"Request to capture a screenshot and console logs of the initial state of a website. This tool navigates to the specified URL, takes a screenshot of the entire page as it appears immediately after loading, and collects any console logs or errors that occur during page load. It does not interact with the page or capture any state changes after the initial load.",
	parameters: {
		url: {
			type: "string",
			description:
				"The URL of the site to inspect. This should be a valid URL including the protocol (e.g. http://localhost:3000/page, file:///path/to/file.html, etc.)",
			required: true,
		},
	},
	capabilities: [
		"You can use the url_screenshot tool to capture a screenshot and console logs of the initial state of a website (including html files and locally running development servers) when you feel it is necessary in accomplishing the user's task. This tool may be useful at key stages of web development tasks-such as after implementing new features, making substantial changes, when troubleshooting issues, or to verify the result of your work. You can analyze the provided screenshot to ensure correct rendering or identify errors, and review console logs for runtime issues.\n	- For example, if asked to add a component to a react website, you might create the necessary files, run the site locally, then use url_screenshot to verify there are no runtime errors on page load.",
	],
	examples: [
		{
			description: "Take a screenshot of a website",
			output: `<url_screenshot>
<url>URL of the site to inspect</url>
</url_screenshot>`,
		},
	],
	requiresFeatures: ["vision"],
}
