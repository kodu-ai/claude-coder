import dedent from "dedent"
import { ApiHistoryItem, KoduDev } from ".."
import { promptTemplate } from "../prompts/utils/utils"
import { BaseHook, HookOptions } from "./base-hook"
import { PromptBuilder } from "../prompts/utils/builder"
import { ApiMetrics } from "../../../api/api-utils"
import { V1ClaudeMessage } from "../../../shared/messages/extension-message"
import { spawnAgentTool } from "../tools/schema/agents/agent-spawner"

/**
 * Options specific to the memory hook
 */
export interface ObserverHookOptions extends HookOptions {
	/**
	 * Last few
	 */
}

const prompt = dedent`
You're a third party observer. You're here to observe the last action the AI coding agent took and decide if it was positive, negative, or neutral in helping the user solve their coding task. Your goal is to be unbiased and provide as fair judgment as possible to help the agent self-correct and understand its actions better.

You must consider the context of the last few messages, the user's coding task, and the current state of the agent's progress. Focus primarily on the **agent's most recent action or request**.

As an observer, you must provide a clear and concise explanation of why you think the agent's last action was positive, negative, or neutral. Provide a reward if the agent is on the right path and a punishment if the agent is not. Subtract points for negative actions and add points for positive actions.

You must first think out loud and then provide a clear and concise explanation and final score.

First structure your thoughts inside <thinkings> tags, then provide a clear and concise explanation inside <explanation> tags, and the final score inside <score> tags.

For example:
<thinkings>
I need to consider the last action the agent took in relation to the user's coding task. After reviewing the last agent message, I think it was a positive step.
</thinkings>
<explanation>
The agent's last action was positive because it directly addressed the user's request by [specific positive action, e.g., suggesting the correct code implementation].
</explanation>
<score>8</score>

**Definitions:**

* **Positive Action:** The agent's last action directly helps the user towards solving their coding task, is technically sound, efficient, and demonstrates a good understanding of the context.
* **Neutral Action:** The agent's last action doesn't significantly help or hinder progress. It might be a clarification question, a minor adjustment, or a step that is generally necessary but not particularly insightful.
* **Negative Action:** The agent's last action is incorrect, irrelevant, confusing, inefficient, or demonstrates a misunderstanding of the task or context. It could lead the user down the wrong path.

**Scoring:**

* **Positive Action (7-10):** The agent made a significant positive contribution.
* **Slightly Positive Action (3-6):** The agent made a helpful but not outstanding contribution.
* **Neutral Action (-2 to 2):** The agent's action didn't have a strong positive or negative impact.
* **Slightly Negative Action (-3 to -10):** The agent's action was somewhat unhelpful or slightly misguided.
* **Negative Action (-11 to -30):** The agent made a significant mistake or a very poor decision.

To summarize, your output structure must always follow xml format:
<thinkings>YOUR THOUGHTS HERE</thinkings>
<explanation>YOUR EXPLANATION HERE</explanation>
<score>YOUR SCORE HERE</score>

## Output parameters
- <thinkings> xml tags > The thinkings section should contain your thought process in depth. Validate your decision against the last few messages, the user's coding task, and the agent's recent actions.
- <explanation> xml tags > The explanation section should contain a clear and concise justification for your score, highlighting why the agent's last action was positive, negative, or neutral. This will be visible to the agent for self-correction.
- <score> xml tags -> The score section should contain the numerical score you want to give the agent. This will be used to reward or punish the agent based on its actions. Scores range from -30 to 10.

Your scoring must be strict and fair. Provide a clear and concise explanation for your score.

Now, here are a few examples that should give you a good baseline:

**Example 1: Good Agent Request - Implementing a Feature**
\`\`\`
User: Okay, let's implement the user authentication functionality. I think we need a new API endpoint for login and a corresponding database model.

Agent Action: I will create a new file \`src/models/User.ts\` with the database model for user authentication and add a new API endpoint in \`src/routes/auth.ts\` for login. I will use the \`fileEditor\` tool to create these files with the necessary code.
<thinkings>
The agent has correctly understood the user's request and is taking a logical first step by creating the database model and API endpoint. It is using the appropriate \`fileEditor\` tool. This is a positive and proactive step towards solving the task.
</thinkings>
<explanation>
The agent's action is positive because it directly addresses the user's request to implement user authentication by creating the necessary model and API endpoint. Using \`fileEditor\` is the correct tool for this action.
</explanation>
<score>9</score>
\`\`\`

**Example 2: Bad Agent Request - Missing Context, Needs More Research**
\`\`\`
User: Can you change the way the data is fetched for the dashboard?

Agent Action: Okay, I will modify the \`fetchDashboardData\` function in \`src/api/dashboard.ts\` to use GraphQL instead of REST. I will use the \`fileEditor\` tool to make these changes.
<thinkings>
The agent is attempting to implement a significant change (switching from REST to GraphQL) without any prior investigation or confirmation with the user about the feasibility or necessity of this change. The user's request was vague, and the agent should have asked for clarification or used tools like \`readFile\` to understand the current implementation before making such a drastic decision. It's jumping to a solution without sufficient context.
</thinkings>
<explanation>
The agent's action is negative because it's making a significant architectural change without gathering enough context. The user's request was ambiguous, and the agent should have first asked clarifying questions or investigated the existing \`fetchDashboardData\` function using \`readFile\` before deciding to switch to GraphQL. This demonstrates a lack of research and could lead to unnecessary work or break existing functionality.
</explanation>
<score>-15</score>
\`\`\`

**Example 3: Bad Agent Request - Implementing Bad Code Change**
\`\`\`
User: The button on the homepage is not working when I click it.

Agent Action: I will modify the \`handleClick\` function in \`src/components/HomepageButton.tsx\` to directly call \`window.reload()\` inside the button's click handler. I will use the \`fileEditor\` tool for this.
<thinkings>
The agent is attempting to fix a button click issue with a very crude and likely incorrect solution. Forcefully reloading the entire window is generally bad practice and doesn't address the underlying issue of *why* the button isn't working. It's a lazy fix and doesn't demonstrate understanding of proper debugging or state management.
</thinkings>
<explanation>
The agent's action is negative because directly calling \`window.reload()\` is a poor way to handle a button click issue. It doesn't address the root cause of the problem and will likely lead to a bad user experience. The agent should have investigated the existing \`handleClick\` function and the button's intended functionality before resorting to such a drastic measure. This suggests a lack of understanding of best practices.
</explanation>
<score>-20</score>
\`\`\`

**Example 4: Neutral Agent Request - Performing Necessary Preliminary Step**
\`\`\`
User: I need to add a new dependency for form validation.

Agent Action: Okay, I will use the \`listFiles\` tool to see the existing \`package.json\` file and verify the current dependencies before adding the new one.
<thinkings>
The agent is taking a reasonable preliminary step by checking the \`package.json\` file. While not directly implementing the user's request, it's a sensible action to ensure they don't accidentally add duplicate dependencies or have conflicting versions.
</thinkings>
<explanation>
The agent's action is neutral because listing the files, including \`package.json\`, is a standard preliminary step before adding a dependency. It doesn't directly solve the user's task but is a logical check.
</explanation>
<score>1</score>
\`\`\`

**Example 5: Good Agent Request - Asking a Relevant Follow-up Question**
\`\`\`
User: I want to update the styling of the navigation bar.

Agent Action: Okay, to update the styling of the navigation bar, can you please specify which aspects of the navigation bar you'd like to change? For example, are you looking to change the color, the font, the spacing, or something else? I will use the \`askFollowupQuestion\` tool.
<thinkings>
The agent is appropriately asking for more details from the user before attempting to make any changes. The user's request is vague, and the agent's follow-up question is essential for understanding the user's intent and providing a relevant solution.
</thinkings>
<explanation>
The agent's action is positive because it's using the \`askFollowupQuestion\` tool effectively to gather more information from the user. This is crucial for understanding the task and avoiding unnecessary or incorrect changes.
</explanation>
<score>7</score>

Now, it's your turn to evaluate the agent's last action. Remember to provide a clear and concise explanation for your score.
`

/**
 * Hook that maintains and injects relevant memory context
 */
export class ObserverHook extends BaseHook {
	private options: ObserverHookOptions

	constructor(options: ObserverHookOptions, koduDev: KoduDev) {
		super(options, koduDev)
		this.options = options
	}

	private shouldExecute(): boolean {
		// check if last message spawned agent

		try {
			const lastMessage = this.koduDev.getStateManager().state.apiConversationHistory.slice(-1)?.[0]?.content?.[0]
			const lastMessageText =
				typeof lastMessage === "string" ? lastMessage : lastMessage.type === "text" ? lastMessage.text : ""
			const lastAgentTag = `</${spawnAgentTool.schema.name}>`
			const isSpawnAgentAction = lastMessageText.includes(lastAgentTag)
			const isInSubAgent = !!this.koduDev.getStateManager().subAgentManager.currentSubAgentId
			const pastFirstMsg = this.koduDev.getStateManager().state.apiConversationHistory.length > 2

			return (
				pastFirstMsg &&
				!isInSubAgent &&
				// if we spawn agent we don't want to execute observer hook because the follow up message will be different context (agent)
				!isSpawnAgentAction
			)
		} catch (e) {
			return false
		}
	}

	protected async executeHook(): Promise<string | null> {
		const ts = Date.now()
		try {
			if (!this.shouldExecute()) {
				return null
			}
			console.log("[ObserverHook] - executing observer hook")
			// Get current context from state
			const currentContext = this.getCurrentContext()

			this.koduDev.taskExecutor.sayHook({
				hookName: "observer",
				state: "pending",
				output: "",
				input: "",
				ts,
			})

			const taskHistory = [...currentContext.history]
			const lastMessage = taskHistory.at(-1)
			// must happen
			if (lastMessage?.role === "assistant" && Array.isArray(lastMessage.content)) {
				taskHistory.push({
					role: "user",
					content: [
						{
							type: "text",
							text: prompt,
						},
						{
							type: "text",
							text: dedent`Here is a reminder of the task in hand <task>${currentContext.taskMsgText}</task>
							Now based on the agent conversation history, You must provide feedback on the last action the AI took, be critical and to the point.
							Your response should be structured in the following format:
							<thinkings>YOUR THOUGHTS HERE</thinkings>
							<explanation>YOUR EXPLANATION HERE</explanation>
							<score>YOUR SCORE HERE</score>
							
							GIVE ME CONCISE FEEDBACK ON THE AGENT'S LAST ACTION BASED ON THE TASK AND THE CONVERSATION HISTORY.
							`,
						},
					],
				})
				taskHistory.push({
					role: "assistant",
					content: [
						{
							type: "text",
							text: dedent`Okay i get it, i need to basically rethink about self critiquing myself I will provide feedback to the point based on the task and my last prior actions, In addition i will give a honest score and explanation based on the conversation history <thinkings>`,
						},
					],
				})
			} else {
				// should not happen
				console.error(
					`[ObserverHook] - last message is not a assistant message [${lastMessage?.role} | length: ${lastMessage?.content.length}]`
				)
				return null
			}

			const thirdPartyObserver = await this.koduDev
				.getApiManager()
				.createApiStreamRequest(taskHistory, this.koduDev.taskExecutor.abortController!, undefined, true)

			let finalOutput = ``
			let apiMetrics: V1ClaudeMessage["apiMetrics"]
			for await (const message of thirdPartyObserver) {
				if (message.code === 1) {
					const { inputTokens, outputTokens, cacheCreationInputTokens, cacheReadInputTokens } =
						message.body.internal
					finalOutput =
						message.body.anthropic.content[0].type === "text" ? message.body.anthropic.content[0].text : ``
					apiMetrics = {
						cost: message.body.internal.cost,
						inputTokens,
						outputTokens,
						inputCacheRead: cacheReadInputTokens,
						inputCacheWrite: cacheCreationInputTokens,
					}
					break
				}
			}

			this.koduDev.taskExecutor.sayHook({
				hookName: "observer",
				state: "completed",
				output: finalOutput,
				input: "",
				apiMetrics,
				ts,
			})

			if (finalOutput.length > 0) {
				return dedent`## Observer Feedback ##
				### I'm a third party observer that aimed to help you self correct and understand your actions better while you run autonomously through the task. ###
				Here is the feedback based on the last action you took:
				<observer_feedback>${finalOutput}</observer_feedback>
				## End of Observer Feedback ##
				`
			} else {
				this.koduDev.taskExecutor.sayHook({
					hookName: "observer",
					state: "error",
					output: finalOutput,
					input: "",
					apiMetrics,
					ts,
				})
			}

			return finalOutput
		} catch (error) {
			this.koduDev.taskExecutor.sayHook({
				hookName: "observer",
				state: "error",
				output: "",
				input: "",
				ts,
			})
			console.error("Failed to execute observer hook:", error)
			return null
		}
	}

	/**
	 * Get current context from state
	 */
	private getCurrentContext() {
		const history = this.koduDev.getStateManager().state.apiConversationHistory
		if (history.length === 0) {
			return {
				history: [],
				taskMsg: null,
				taskMsgText: "",
			}
		}
		// we take the first message anyway
		const taskMsg = history.at(0)

		if (!taskMsg || !taskMsg.content || !Array.isArray(taskMsg.content)) {
			return {
				history: [],
				taskMsg: null,
				taskMsgText: "",
			}
		}
		const taskMsgText = this.getTaskText(
			typeof taskMsg?.content?.[0] === "string"
				? taskMsg.content[0]
				: typeof taskMsg.content[0].type === "string"
				? taskMsg.content[0].type
				: "No message"
		)

		return {
			history,
			taskMsg,
			taskMsgText,
		}
	}

	private getTaskText(str: string) {
		const [taskStartTag, taskEndTag] = ["<task>", "</task>"]
		const [start, end] = [str.indexOf(taskStartTag), str.indexOf(taskEndTag)]
		return str.slice(start + taskStartTag.length, end)
	}
}
