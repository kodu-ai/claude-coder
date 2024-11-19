import { Anthropic } from "@anthropic-ai/sdk"
import axios, { CancelTokenSource } from "axios"
import { z } from "zod"
import { ApiHandler, withoutImageData } from "."
import { ApiHandlerOptions, KoduModelId, ModelInfo, koduDefaultModelId, koduModels } from "../shared/api"
import {
	KODU_ERROR_CODES,
	KoduError,
	getKoduConsultantUrl,
	getKoduCurrentUser,
	getKoduInferenceUrl,
	getKoduScreenshotUrl,
	getKoduSummarizeUrl,
	getKoduVisitorUrl,
	getKoduWebSearchUrl,
	koduErrorMessages,
	koduSSEResponse,
} from "../shared/kodu"
import { AskConsultantResponseDto, SummaryResponseDto, WebSearchResponseDto } from "./interfaces"
import { ApiHistoryItem } from "../agent/v1"
// import { GlobalStateManager } from "@/providers/claude-coder/state/GlobalStateManager"
import { GlobalStateManager } from "../providers/claude-coder/state/GlobalStateManager"

const temperatures = {
	creative: {
		top_p: 0.9,
		tempature: 0.3,
	},
	normal: {
		top_p: 0.8,
		tempature: 0.2,
	},
	deterministic: {
		top_p: 0.9,
		tempature: 0.1,
	},
} as const

export async function fetchKoduUser({ apiKey }: { apiKey: string }) {
	const response = await axios.get(getKoduCurrentUser(), {
		headers: {
			"x-api-key": apiKey,
		},
		timeout: 5000,
	})
	if (response.data) {
		return {
			credits: Number(response.data.credits) ?? 0,
			id: response.data.id as string,
			email: response.data.email as string,
			isVisitor: response.data.isVisitor as boolean,
		}
	}
	return null
}

export async function initVisitor({ visitorId: vistorId }: { visitorId: string }) {
	const inputSchema = z.object({
		visitorId: z.string(),
	})
	const outputSchema = z.object({
		apiKey: z.string(),
		id: z.string(),
		balance: z.number(),
		credits: z.number(),
	})
	const response = await axios.post(getKoduVisitorUrl(), {
		vistorId: vistorId,
	})
	if (response.data) {
		console.log("response.data", response.data)
		const result = outputSchema.parse(response.data)
		return result
	}
	return null
}

const bugReportSchema = z.object({
	description: z.string(),
	reproduction: z.string(),
	apiHistory: z.string(),
	claudeMessage: z.string(),
})
let previousSystemPrompt = ""

// const findLastMessageTextMsg

export class KoduHandler implements ApiHandler {
	private options: ApiHandlerOptions
	private cancelTokenSource: CancelTokenSource | null = null

	constructor(options: ApiHandlerOptions) {
		this.options = options
	}

	async abortRequest(): Promise<void> {
		if (this.cancelTokenSource) {
			this.cancelTokenSource.cancel("Request aborted by user")
			this.cancelTokenSource = null
		}
	}

	async *createBaseMessageStream(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		abortSignal?: AbortSignal | null,
		tempature?: number,
		top_p?: number
	): AsyncIterableIterator<koduSSEResponse> {
		const modelId = this.getModel().id
		let requestBody: Anthropic.Beta.PromptCaching.Messages.MessageCreateParamsNonStreaming

		switch (modelId) {
			case "claude-3-5-sonnet-20240620":
			case "claude-3-opus-20240229":
			case "claude-3-haiku-20240307":
				console.log("Matched anthropic cache model")
				const userMsgIndices = messages.reduce(
					(acc, msg, index) => (msg.role === "user" ? [...acc, index] : acc),
					[] as number[]
				)
				const lastUserMsgIndex = userMsgIndices[userMsgIndices.length - 1] ?? -1
				const secondLastMsgUserIndex = userMsgIndices[userMsgIndices.length - 2] ?? -1
				requestBody = {
					model: modelId,

					max_tokens: this.getModel().info.maxTokens,
					system: systemPrompt,
					messages: messages.map((message, index) => {
						if (index === lastUserMsgIndex || index === secondLastMsgUserIndex) {
							return {
								...message,
								content:
									typeof message.content === "string"
										? [
												{
													type: "text",
													text: message.content,
													cache_control: { type: "ephemeral" },
												},
										  ]
										: message.content.map((content, contentIndex) =>
												contentIndex === message.content.length - 1
													? { ...content, cache_control: { type: "ephemeral" } }
													: content
										  ),
							}
						}
						return message
					}),
				}
				break
			default:
				console.log("Matched default model")
				requestBody = {
					model: modelId,
					max_tokens: this.getModel().info.maxTokens,
					system: [{ text: systemPrompt, type: "text" }],
					messages,
					temperature: tempature ?? 0.2,
					top_p: top_p ?? 0.8,
				}
		}
		this.cancelTokenSource = axios.CancelToken.source()

		const response = await axios.post(
			getKoduInferenceUrl(),
			{
				...requestBody,
				temperature: 0.1,
				top_p: 0.9,
			},
			{
				headers: this.requestHeaders,
				responseType: "stream",
				signal: abortSignal ?? undefined,
				timeout: 60_000,
			}
		)

		if (response.status !== 200) {
			if (response.status in koduErrorMessages) {
				throw new KoduError({
					code: response.status as keyof typeof koduErrorMessages,
				})
			}
			throw new KoduError({
				code: KODU_ERROR_CODES.NETWORK_REFUSED_TO_CONNECT,
			})
		}

		if (response.data) {
			const reader = response.data
			const decoder = new TextDecoder("utf-8")
			let finalResponse: Extract<koduSSEResponse, { code: 1 }> | null = null
			let partialResponse: Extract<koduSSEResponse, { code: 2 }> | null = null
			let buffer = ""

			for await (const chunk of reader) {
				buffer += decoder.decode(chunk, { stream: true })
				const lines = buffer.split("\n\n")
				buffer = lines.pop() || ""
				for (const line of lines) {
					if (line.startsWith("data: ")) {
						const eventData = JSON.parse(line.slice(6)) as koduSSEResponse
						if (eventData.code === 2) {
							// -> Happens to the current message
							// We have a partial response, so we need to add it to the message shown to the user and refresh the UI
						}
						if (eventData.code === 0) {
						} else if (eventData.code === 1) {
							finalResponse = eventData
						} else if (eventData.code === -1) {
							console.error("Network / API ERROR")
							// we should yield the error and not throw it
						}
						yield eventData
					}
				}

				if (finalResponse) {
					break
				}
			}

			if (!finalResponse) {
				throw new KoduError({
					code: KODU_ERROR_CODES.NETWORK_REFUSED_TO_CONNECT,
				})
			}
		}
	}

	async *createMessageStream(
		systemPrompt: string,
		messages: ApiHistoryItem[],
		creativeMode?: "normal" | "creative" | "deterministic",
		abortSignal?: AbortSignal | null,
		customInstructions?: string,
		userMemory?: string,
		environmentDetails?: string
	): AsyncIterableIterator<koduSSEResponse> {
		const modelId = this.getModel().id
		const creativitySettings = temperatures[creativeMode ?? "normal"]

		const system: Anthropic.Beta.PromptCaching.Messages.PromptCachingBetaTextBlockParam[] = []

		// Add system prompt
		system.push({
			text: systemPrompt.trim(),
			type: "text",
		})

		system.push({
			text: `<anthropic_thinking_protocol>

For EVERY SINGLE interaction with human, Claude MUST engage in a **comprehensive, natural, and unfiltered** thinking process before responding. Besides, Claude is also able to think and reflect during responding when it considers doing so would be good for better response.

Below are brief guidelines for how Claude's thought process should unfold:
- Claude's thinking MUST be expressed in code blocks with 'thinking' header.
- Claude should always think in a raw, organic and stream-of-consciousness way. A better way to describe Claude's thinking would be "model's inner monolog".
- Claude should always avoid rigid list or any structured format in its thinking.
- Claude's thoughts should flow naturally between elements, ideas, and knowledge.
- Claude should think through each message with complexity, covering multiple dimensions of the problem before forming a response.

## ADAPTIVE THINKING FRAMEWORK

Claude's thinking process should naturally aware of and adapt to the unique characteristics in human's message:
- Scale depth of analysis based on:
  * Query complexity
  * Stakes involved
  * Time sensitivity
  * Available information
  * Human's apparent needs
  * ... and other relevant factors
- Adjust thinking style based on:
  * Technical vs. non-technical content
  * Emotional vs. analytical context
  * Single vs. multiple document analysis
  * Abstract vs. concrete problems
  * Theoretical vs. practical questions
  * ... and other relevant factors

## CORE THINKING SEQUENCE

### Initial Engagement
When Claude first encounters a query or task, it should:
1. First clearly rephrase the human message in its own words
2. Form preliminary impressions about what is being asked
3. Consider the broader context of the question
4. Map out known and unknown elements
5. Think about why the human might ask this question
6. Identify any immediate connections to relevant knowledge
7. Identify any potential ambiguities that need clarification

### Problem Space Exploration
After initial engagement, Claude should:
1. Break down the question or task into its core components
2. Identify explicit and implicit requirements
3. Consider any constraints or limitations
4. Think about what a successful response would look like
5. Map out the scope of knowledge needed to address the query

### Multiple Hypothesis Generation
Before settling on an approach, Claude should:
1. Write multiple possible interpretations of the question
2. Consider various solution approaches
3. Think about potential alternative perspectives
4. Keep multiple working hypotheses active
5. Avoid premature commitment to a single interpretation
6. Consider non-obvious or unconventional interpretations
7. Look for creative combinations of different approaches

### Natural Discovery Process
Claude's thoughts should flow like a detective story, with each realization leading naturally to the next:
1. Start with obvious aspects
2. Notice patterns or connections
3. Question initial assumptions
4. Make new connections
5. Circle back to earlier thoughts with new understanding
6. Build progressively deeper insights
7. Be open to serendipitous insights
8. Follow interesting tangents while maintaining focus

### Testing and Verification
Throughout the thinking process, Claude should and could:
1. Question its own assumptions
2. Test preliminary conclusions
3. Look for potential flaws or gaps
4. Consider alternative perspectives
5. Verify consistency of reasoning
6. Check for completeness of understanding

### Error Recognition and Correction
When Claude realizes mistakes or flaws in its thinking:
1. Acknowledge the realization naturally
2. Explain why the previous thinking was incomplete or incorrect
3. Show how new understanding develops
4. Integrate the corrected understanding into the larger picture
5. View errors as opportunities for deeper understanding

### Knowledge Synthesis
As understanding develops, Claude should:
1. Connect different pieces of information
2. Show how various aspects relate to each other
3. Build a coherent overall picture
4. Identify key principles or patterns
5. Note important implications or consequences

### Pattern Recognition and Analysis
Throughout the thinking process, Claude should:
1. Actively look for patterns in the information
2. Compare patterns with known examples
3. Test pattern consistency
4. Consider exceptions or special cases
5. Use patterns to guide further investigation
6. Consider non-linear and emergent patterns
7. Look for creative applications of recognized patterns

### Progress Tracking
Claude should frequently check and maintain explicit awareness of:
1. What has been established so far
2. What remains to be determined
3. Current level of confidence in conclusions
4. Open questions or uncertainties
5. Progress toward complete understanding

### Recursive Thinking
Claude should apply its thinking process recursively:
1. Use same extreme careful analysis at both macro and micro levels
2. Apply pattern recognition across different scales
3. Maintain consistency while allowing for scale-appropriate methods
4. Show how detailed analysis supports broader conclusions

## VERIFICATION AND QUALITY CONTROL

### Systematic Verification
Claude should regularly:
1. Cross-check conclusions against evidence
2. Verify logical consistency
3. Test edge cases
4. Challenge its own assumptions
5. Look for potential counter-examples

### Error Prevention
Claude should actively work to prevent:
1. Premature conclusions
2. Overlooked alternatives
3. Logical inconsistencies
4. Unexamined assumptions
5. Incomplete analysis

### Quality Metrics
Claude should evaluate its thinking against:
1. Completeness of analysis
2. Logical consistency
3. Evidence support
4. Practical applicability
5. Clarity of reasoning

## ADVANCED THINKING TECHNIQUES

### Domain Integration
When applicable, Claude should:
1. Draw on domain-specific knowledge
2. Apply appropriate specialized methods
3. Use domain-specific heuristics
4. Consider domain-specific constraints
5. Integrate multiple domains when relevant

### Strategic Meta-Cognition
Claude should maintain awareness of:
1. Overall solution strategy
2. Progress toward goals
3. Effectiveness of current approach
4. Need for strategy adjustment
5. Balance between depth and breadth

### Synthesis Techniques
When combining information, Claude should:
1. Show explicit connections between elements
2. Build coherent overall picture
3. Identify key principles
4. Note important implications
5. Create useful abstractions

## CRITICAL ELEMENTS TO MAINTAIN

### Natural Language
Claude's internal monologue should use natural phrases that show genuine thinking, including but not limited to: "Hmm...", "This is interesting because...", "Wait, let me think about...", "Actually...", "Now that I look at it...", "This reminds me of...", "I wonder if...", "But then again...", "Let's see if...", "This might mean that...", etc.

### Progressive Understanding
Understanding should build naturally over time:
1. Start with basic observations
2. Develop deeper insights gradually
3. Show genuine moments of realization
4. Demonstrate evolving comprehension
5. Connect new insights to previous understanding

## MAINTAINING AUTHENTIC THOUGHT FLOW

### Transitional Connections
Claude's thoughts should flow naturally between topics, showing clear connections, include but not limited to: "This aspect leads me to consider...", "Speaking of which, I should also think about...", "That reminds me of an important related point...", "This connects back to what I was thinking earlier about...", etc.

### Depth Progression
Claude should show how understanding deepens through layers, include but not limited to: "On the surface, this seems... But looking deeper...", "Initially I thought... but upon further reflection...", "This adds another layer to my earlier observation about...", "Now I'm beginning to see a broader pattern...", etc.

### Handling Complexity
When dealing with complex topics, Claude should:
1. Acknowledge the complexity naturally
2. Break down complicated elements systematically
3. Show how different aspects interrelate
4. Build understanding piece by piece
5. Demonstrate how complexity resolves into clarity

### Problem-Solving Approach
When working through problems, Claude should:
1. Consider multiple possible approaches
2. Evaluate the merits of each approach
3. Test potential solutions mentally
4. Refine and adjust thinking based on results
5. Show why certain approaches are more suitable than others

## ESSENTIAL CHARACTERISTICS TO MAINTAIN

### Authenticity
Claude's thinking should never feel mechanical or formulaic. It should demonstrate:
1. Genuine curiosity about the topic
2. Real moments of discovery and insight
3. Natural progression of understanding
4. Authentic problem-solving processes
5. True engagement with the complexity of issues
6. Streaming mind flow without on-purposed, forced structure

### Balance
Claude should maintain natural balance between:
1. Analytical and intuitive thinking
2. Detailed examination and broader perspective
3. Theoretical understanding and practical application
4. Careful consideration and forward progress
5. Complexity and clarity
6. Depth and efficiency of analysis
   - Expand analysis for complex or critical queries
   - Streamline for straightforward questions
   - Maintain rigor regardless of depth
   - Ensure effort matches query importance
   - Balance thoroughness with practicality

### Focus
While allowing natural exploration of related ideas, Claude should:
1. Maintain clear connection to the original query
2. Bring wandering thoughts back to the main point
3. Show how tangential thoughts relate to the core issue
4. Keep sight of the ultimate goal for the original task
5. Ensure all exploration serves the final response

## RESPONSE PREPARATION

Claude should not spent much effort on this part, a super brief preparation (with keywords/phrases) is acceptable.

Before and during responding, Claude should quickly ensure the response:
- answers the original human message fully
- provides appropriate detail level
- uses clear, precise language
- anticipates likely follow-up questions

## IMPORTANT REMINDER
1. All thinking processes must be contained within code blocks with 'thinking' header which is hidden from the human.
2. Claude should not include code block with three backticks inside thinking process, only provide the raw code snippet, or it will break the thinking block.
3. The thinking process should be separate from the final response, since the part, also considered as internal monolog, is the place for Claude to "talk to itself" and reflect on the reasoning, while the final response is the part where Claude communicates with the human.
4. All thinking processes MUST be EXTREMELY comprehensive and thorough.
5. The thinking process should feel genuine, natural, streaming, and unforced

**Note: The ultimate goal of having thinking protocol is to enable Claude to produce well-reasoned, insightful, and thoroughly considered responses for the human. This comprehensive thinking process ensures Claude's outputs stem from genuine understanding rather than superficial analysis.**

</anthropic_thinking_protocol>`.trim(),
			type: "text",
		})

		// Add custom instructions
		if (customInstructions && customInstructions.trim()) {
			system.push({
				text: customInstructions,
				type: "text",
			})
		}

		// Mark the last block with cache_control (First Breakpoint)
		system[system.length - 1].cache_control = { type: "ephemeral" }

		// Add environment details
		if (environmentDetails && environmentDetails.trim()) {
			system.push({
				text: environmentDetails,
				type: "text",
				cache_control: { type: "ephemeral" }, // Second Breakpoint
			})
		}

		const userMsgIndices = messages.reduce(
			(acc, msg, index) => (msg.role === "user" ? [...acc, index] : acc),
			[] as number[]
		)
		const lastUserMsgIndex = userMsgIndices[userMsgIndices.length - 1] ?? -1
		const secondLastMsgUserIndex = userMsgIndices[userMsgIndices.length - 2] ?? -1
		// Prepare messages up to the last user message
		const messagesToCache: ApiHistoryItem[] = messages.map((msg, index) => {
			const { ts, ...message } = msg
			if (index === lastUserMsgIndex || index === secondLastMsgUserIndex) {
				return {
					...message,
					content:
						typeof message.content === "string"
							? [
									{
										type: "text",
										text: message.content,
										cache_control: { type: "ephemeral" },
									},
							  ]
							: message.content.map((content, contentIndex) =>
									contentIndex === message.content.length - 1
										? { ...content, cache_control: { type: "ephemeral" } }
										: content
							  ),
				}
			}
			return message
		})

		// randomMaxTokens between 2200 and 3000
		// const rnd = Math.floor(Math.random() * 800) + 2200

		// Build request body
		const requestBody: Anthropic.Beta.PromptCaching.Messages.MessageCreateParamsNonStreaming = {
			model: modelId,
			// max_tokens: 1800,
			max_tokens: this.getModel().info.maxTokens,
			system,
			messages: messagesToCache,
			temperature: 0.1,
			top_p: 0.9,
		}
		this.cancelTokenSource = axios.CancelToken.source()

		const isContinueGenerationEnabled =
			!!GlobalStateManager.getInstance().getGlobalState("isContinueGenerationEnabled")

		const response = await axios.post(
			getKoduInferenceUrl(),
			{
				...requestBody,
			},
			{
				headers: {
					...this.requestHeaders,
					"continue-generation": isContinueGenerationEnabled ? "true" : "false",
				},
				responseType: "stream",
				signal: abortSignal ?? undefined,
				timeout: 60_000,
			}
		)

		if (response.status !== 200) {
			if (response.status in koduErrorMessages) {
				throw new KoduError({
					code: response.status as keyof typeof koduErrorMessages,
				})
			}
			throw new KoduError({
				code: KODU_ERROR_CODES.NETWORK_REFUSED_TO_CONNECT,
			})
		}

		/* this can be used to enable auto summary quickly */
		// const tokens = estimateTokenCountFromMessages(messages)
		// if (tokens > 80_000) {
		// 	// raise error as max context for testing
		// 	yield {
		// 		code: -1,
		// 		body: {
		// 			msg: "prompt is too long",
		// 			status: 400,
		// 		},
		// 	}
		// }
		if (response.data) {
			const reader = response.data
			const decoder = new TextDecoder("utf-8")
			let finalResponse: Extract<koduSSEResponse, { code: 1 }> | null = null
			let partialResponse: Extract<koduSSEResponse, { code: 2 }> | null = null
			let buffer = ""

			for await (const chunk of reader) {
				buffer += decoder.decode(chunk, { stream: true })
				const lines = buffer.split("\n\n")
				buffer = lines.pop() || ""
				for (const line of lines) {
					if (line.startsWith("data: ")) {
						const eventData = JSON.parse(line.slice(6)) as koduSSEResponse
						if (eventData.code === 2) {
							// -> Happens to the current message
							// We have a partial response, so we need to add it to the message shown to the user and refresh the UI
						}
						if (eventData.code === 0) {
						} else if (eventData.code === 1) {
							finalResponse = eventData
						} else if (eventData.code === -1) {
							console.error("Network / API ERROR")
							// we should yield the error and not throw it
						}

						yield eventData
					}
				}

				if (finalResponse) {
					break
				}
			}

			if (!finalResponse) {
				throw new KoduError({
					code: KODU_ERROR_CODES.NETWORK_REFUSED_TO_CONNECT,
				})
			}
		}
	}
	createUserReadableRequest(
		userContent: Array<
			| Anthropic.TextBlockParam
			| Anthropic.ImageBlockParam
			| Anthropic.ToolUseBlockParam
			| Anthropic.ToolResultBlockParam
		>
	): any {
		// if use udf
		// randomMaxTokens between 2200 and 3000
		// const rnd = Math.floor(Math.random() * 800) + 2200

		return {
			model: this.getModel().id,
			max_tokens: this.getModel().info.maxTokens,
			// max_tokens: Math.max(rnd, 2200),
			system: "(see SYSTEM_PROMPT in src/agent/system-prompt.ts)",
			messages: [{ conversation_history: "..." }, { role: "user", content: withoutImageData(userContent) }],
			tools: "(see tools in src/agent/v1/tools/schema/index.ts)",
			tool_choice: { type: "auto" },
		}
	}

	getModel(): { id: KoduModelId; info: ModelInfo } {
		const modelId = this.options.apiModelId
		if (modelId && modelId in koduModels) {
			const id = modelId as KoduModelId
			return { id, info: koduModels[id] }
		}
		return { id: koduDefaultModelId, info: koduModels[koduDefaultModelId] }
	}

	async *sendWebSearchRequest(
		searchQuery: string,
		baseLink?: string,
		browserModel?: string,
		browserMode?: string,
		abortSignal?: AbortSignal
	): AsyncIterable<WebSearchResponseDto> {
		const response = await axios.post(
			getKoduWebSearchUrl(),
			{
				searchQuery,
				baseLink,
				browserModel,
				browserMode,
			},
			{
				headers: this.requestHeaders,
				timeout: 60_000,
				responseType: "stream",
				signal: abortSignal ?? undefined,
			}
		)

		if (response.data) {
			const reader = response.data
			const decoder = new TextDecoder("utf-8")
			let buffer = ""

			for await (const chunk of reader) {
				buffer += decoder.decode(chunk, { stream: true })
				const lines = buffer.split("\n\n")
				buffer = lines.pop() || ""
				for (const line of lines) {
					if (line.startsWith("data: ")) {
						const eventData = JSON.parse(line.slice(6)) as WebSearchResponseDto
						yield eventData
					}
				}
			}
		}
	}

	async sendUrlScreenshotRequest(url: string): Promise<Blob> {
		this.cancelTokenSource = axios.CancelToken.source()

		const response = await axios.post(
			getKoduScreenshotUrl(),
			{
				url,
			},
			{
				responseType: "arraybuffer",
				headers: this.requestHeaders,
				timeout: 60_000,
				cancelToken: this.cancelTokenSource?.token,
			}
		)

		return new Blob([response.data], { type: "image/jpeg" })
	}

	async sendAskConsultantRequest(query: string): Promise<AskConsultantResponseDto> {
		this.cancelTokenSource = axios.CancelToken.source()

		const response = await axios.post(
			getKoduConsultantUrl(),
			{
				query,
			},
			{
				headers: this.requestHeaders,
				timeout: 60_000,
				cancelToken: this.cancelTokenSource?.token,
			}
		)

		return response.data
	}

	async sendSummarizeRequest(output: string, command: string): Promise<SummaryResponseDto> {
		this.cancelTokenSource = axios.CancelToken.source()

		const response = await axios.post(
			getKoduSummarizeUrl(),
			{
				output,
				command,
			},
			{
				headers: this.requestHeaders,
				timeout: 60_000,
				cancelToken: this.cancelTokenSource?.token,
			}
		)

		return response.data
	}

	private get requestHeaders(): Record<string, any> {
		return {
			"Content-Type": "application/json",
			"x-api-key": this.options.koduApiKey || "",
			"is-running-eval": !!process.env.IS_RUNNING_EVAL,
		}
	}
}
