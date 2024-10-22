import { useExtensionState } from '@/context/ExtensionStateContext'
import { Loader2 } from 'lucide-react'
import type React from 'react'
import type { ClaudeSayTool } from '../../../../../src/shared/ExtensionMessage'
import CodeBlock from '../../CodeBlock/CodeBlock'
import type { ToolRendererProps } from '../ToolRenderer'

export const UrlScreenshotTool: React.FC<ToolRendererProps> = ({
	message,
	syntaxHighlighterStyle,
	isExpanded,
	onToggleExpand,
}) => {
	const tool = JSON.parse(message.text || '{}') as ClaudeSayTool
	if (tool.tool !== 'url_screenshot') {
		return null
	}

	const { claudeMessages } = useExtensionState()
	const toolIcon = (name: string) => <span className={`codicon codicon-${name} text-alt`} />
	const lastMessage = claudeMessages[claudeMessages.length - 1]

	return (
		<>
			<h3 className="text-alt items-center flex gap-1.5">
				{lastMessage.text === message.text ? (
					<Loader2 className="animate-spin size-4" />
				) : (
					toolIcon('device-camera')
				)}
				{message.type === 'ask' ? (
					<>Claude wants to take a screenshot of the url</>
				) : (
					<>Claude took a screenshot of the url</>
				)}
			</h3>

			{tool.base64Image ? (
				<div style={{ maxHeight: '300px', width: '100%', overflow: 'hidden' }}>
					<img
						src={`data:image/jpeg;base64,${tool.base64Image}`}
						style={{ width: '100%', objectFit: 'cover' }}
					/>
				</div>
			) : (
				<CodeBlock
					code={tool.url}
					language="plaintext"
					syntaxHighlighterStyle={syntaxHighlighterStyle}
					isExpanded={isExpanded}
					onToggleExpand={onToggleExpand}
				/>
			)}
		</>
	)
}
