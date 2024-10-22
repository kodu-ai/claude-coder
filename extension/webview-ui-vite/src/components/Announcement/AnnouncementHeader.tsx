import { VSCodeButton } from '@vscode/webview-ui-toolkit/react'
import type React from 'react'

interface AnnouncementHeaderProps {
	version: string
	onClose: () => void
}

const AnnouncementHeader: React.FC<AnnouncementHeaderProps> = ({ version, onClose }) => (
	<div className="flex-line">
		<h3 className="flex-line uppercase text-alt">
			<span className="codicon text-alt codicon-bell-dot" />
			New in v{version}
		</h3>
		<div className="flex-1" />
		<VSCodeButton appearance="icon" onClick={onClose}>
			<span className="codicon codicon-close" />
		</VSCodeButton>
	</div>
)

export default AnnouncementHeader
