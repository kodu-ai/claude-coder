import { Anthropic } from '@anthropic-ai/sdk'
import { findLast } from 'lodash'
import { ExtensionProvider } from '../../../providers/claude-coder/ClaudeCoderProvider'
import { V1ClaudeMessage, isV1ClaudeMessage } from '../../../shared/ExtensionMessage'
import { anthropicMessageToTokens } from '../api-handler'

interface TokenManagementResult {
	percentageUsed: number
	totalTokens: number
	apiConversationHistory: Anthropic.MessageParam[]
	apiMetrics: {
		inputTokens: number
		outputTokens: number
		inputCacheRead: number
		inputCacheWrite: number
	}
}

/**
 * Manages token usage and conversation history, truncating if necessary to stay within context limits
 * @param provider The extension provider reference
 * @param apiConversationHistory The current conversation history
 * @param contextWindow The model's context window size
 * @returns Updated conversation history and API metrics
 */
export async function manageTokensAndConversation(
	providerRef: WeakRef<ExtensionProvider>,
	apiConversationHistory: Anthropic.MessageParam[],
): Promise<TokenManagementResult> {
	const provider = providerRef.deref()
	if (!provider) {
		throw new Error('Provider reference has been garbage collected')
	}

	const claudeMessages = (await provider.getStateManager()?.getState())?.claudeMessages
	let apiMetrics = {
		inputTokens: 0,
		outputTokens: 0,
		inputCacheRead: 0,
		inputCacheWrite: 0,
	}

	// Check last API request metrics
	const lastApiReqFinished = findLast(claudeMessages, (m) => m.say === 'api_req_finished')
	if (lastApiReqFinished?.text) {
		try {
			const { tokensIn = 0, tokensOut = 0, cacheWrites = 0, cacheReads = 0 } = JSON.parse(lastApiReqFinished.text)

			apiMetrics = {
				inputCacheRead: cacheReads,
				inputCacheWrite: cacheWrites,
				inputTokens: tokensIn,
				outputTokens: tokensOut,
			}
		} catch (error) {
			console.error('Error parsing API request metrics:', error)
		}
	} else {
		// Find last V1 message with metrics
		const reversedClaudeMessages = claudeMessages?.slice().reverse()
		const lastV1Message = reversedClaudeMessages?.find((m) => isV1ClaudeMessage(m) && m.apiMetrics)
		if (lastV1Message) {
			apiMetrics = (lastV1Message as V1ClaudeMessage).apiMetrics!
		}
	}

	const totalTokens =
		(apiMetrics.inputTokens || 0) +
		(apiMetrics.outputTokens || 0) +
		(apiMetrics.inputCacheWrite || 0) +
		(apiMetrics.inputCacheRead || 0) +
		anthropicMessageToTokens(apiConversationHistory.at(-1)!)

	const contextWindow = provider.getKoduDev()?.getApiManager().getApi().getModel().info.contextWindow!

	// Calculate percentage of context window used
	const percentageUsed = totalTokens / contextWindow

	return {
		totalTokens,
		percentageUsed,
		apiConversationHistory,
		apiMetrics,
	}
}
