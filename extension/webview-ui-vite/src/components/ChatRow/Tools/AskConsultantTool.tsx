import { useExtensionState } from '@/context/ExtensionStateContext'
import { Loader2 } from 'lucide-react'
import type React from 'react'
import type { ClaudeSayTool } from '../../../../../src/shared/ExtensionMessage'
import CodeBlock from '../../CodeBlock/CodeBlock'
import type { ToolRendererProps } from '../ToolRenderer'

export const AskConsultantTool: React.FC<ToolRendererProps> = ({
	message,
	syntaxHighlighterStyle,
	isExpanded,
	onToggleExpand,
}) => {
	const { claudeMessages } = useExtensionState()
	const tool = JSON.parse(message.text || '{}') as ClaudeSayTool
	const toolIcon = (name: string) => <span className={`codicon codicon-${name} text-alt`} />
	const lastMessage = claudeMessages[claudeMessages.length - 1]
	if (tool.tool !== 'ask_consultant') {
		return null
	}

	return (
		<>
			<h3 className="text-alt items-center flex gap-1.5">
				{lastMessage.text === message.text ? (
					<Loader2 className="animate-spin size-4" />
				) : (
					toolIcon('comment-discussion')
				)}
				{message.type === 'ask' ? (
					<>Claude wants to ask consultant with the query </>
				) : (
					<>Claude's consultant replied </>
				)}
			</h3>
			<CodeBlock
				code={tool.result}
				language="plaintext"
				syntaxHighlighterStyle={syntaxHighlighterStyle}
				isExpanded={isExpanded}
				onToggleExpand={onToggleExpand}
			/>
		</>
	)
}
