import { ToolPromptSchema } from "../utils/types"

export const exitAgentPrompt: ToolPromptSchema = {
	name: "exit_agent",
	description:
		"Exit the current task and return the final result of the task, the result must be detailed and to the point, this result will be passed back to the user for further processing or task completion.",
	parameters: {
		result: {
			type: "string",
			description:
				"The final result or output of the agent operation. This should be a string describing what was accomplished or any relevant output that should be passed back to the user.",
			required: true,
		},
	},
	capabilities: [
		"Once you finish and finalized the task, you can use exit_agent tool to exit the current task and return the final result of the task, the result must be detailed and to the point, this result will be passed back to the user for further processing or task completion, this tool is used to let the user know that the task is completed and the final result is ready for review.",
	],
	examples: [
		{
			description:
				"Exit a task after completing the user request to install the dependencies and run the unit tests",
			output: `<exit_agent>
<result>
I've installed the following dependencies:
- Jest
- Enzyme
- Axios
- React Testing Library

Here is the unit test output:
Test Suites: 3 passed,1 failed, 4 total
PASS src/components/App.test.js
PASS src/components/Header.test.js
PASS src/components/Footer.test.js
FAIL src/components/Profile.test.js - Expected 1, received 0 (I think this is related to the API call)
</result>
</exit_agent>`,
		},
	],
}
