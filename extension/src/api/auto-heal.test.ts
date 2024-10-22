import type { Anthropic } from '@anthropic-ai/sdk'
import { healMessages } from './auto-heal'

type PromptCachingBetaMessageParam = Anthropic.Beta.PromptCaching.Messages.PromptCachingBetaMessageParam

describe('healMessages', () => {
	it('should handle an empty array of messages', () => {
		const result = healMessages([])
		expect(result).toEqual([])
	})

	it('should ensure the conversation starts with a user message', () => {
		const messages: PromptCachingBetaMessageParam[] = [
			{ role: 'assistant', content: 'Hello' },
			{ role: 'user', content: 'Hi' },
		]
		const result = healMessages(messages)
		expect(result[0].role).toBe('user')
		expect(result).toHaveLength(1)
	})

	it('should ensure the conversation ends with a user message', () => {
		const messages: PromptCachingBetaMessageParam[] = [
			{ role: 'user', content: 'Hello' },
			{ role: 'assistant', content: 'Hi' },
		]
		const result = healMessages(messages)
		expect(result).toHaveLength(3)
		expect(result[result.length - 1].role).toBe('user')
		expect(result[result.length - 1].content).toEqual([
			{ type: 'text', text: 'Placeholder: User response missing.' },
		])
	})

	it('should handle tool_use and tool_result', () => {
		const messages: PromptCachingBetaMessageParam[] = [
			{ role: 'user', content: "What's the weather?" },
			{
				role: 'assistant',
				content: [{ type: 'tool_use', id: 'weather1', name: 'get_weather', input: { location: 'New York' } }],
			},
			{ role: 'user', content: [{ type: 'tool_result', tool_use_id: 'weather1', content: 'Sunny' }] },
		]
		const result = healMessages(messages)
		expect(result).toEqual(messages)
	})

	it('should add a placeholder tool_result if missing', () => {
		const messages: PromptCachingBetaMessageParam[] = [
			{ role: 'user', content: "What's the weather?" },
			{
				role: 'assistant',
				content: [{ type: 'tool_use', id: 'weather1', name: 'get_weather', input: { location: 'New York' } }],
			},
		]
		const result = healMessages(messages)
		expect(result).toHaveLength(3)
		expect(result[2].role).toBe('user')
		expect(result[2].content).toEqual([
			{
				type: 'tool_result',
				tool_use_id: 'weather1',
				content: 'Placeholder: tool_result missing or user did not respond.',
			},
		])
	})

	it('should handle mixed string and array content', () => {
		const messages: PromptCachingBetaMessageParam[] = [
			{ role: 'user', content: 'Hello' },
			{
				role: 'assistant',
				content: [
					{ type: 'text', text: 'Hi' },
					{ type: 'tool_use', id: 'greet1', name: 'greet', input: { name: 'User' } },
				],
			},
			{ role: 'user', content: 'Nice to meet you' },
		]
		const result = healMessages(messages)
		expect(result).toHaveLength(3)
		expect(result[2].content).toEqual([
			{
				type: 'tool_result',
				tool_use_id: 'greet1',
				content: 'Placeholder: tool_result missing or user did not respond.',
			},
			{ type: 'text', text: 'Nice to meet you' },
		])
	})
})
