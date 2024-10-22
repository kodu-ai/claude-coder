import { VSCodeButton, VSCodeTextField } from '@vscode/webview-ui-toolkit/react'
import type React from 'react'

const TextFieldWithButtons: React.FC = () => (
	<VSCodeTextField>
		<section slot="end" style={{ display: 'flex', alignItems: 'center' }}>
			<VSCodeButton appearance="icon" aria-label="Match Case">
				<span className="codicon codicon-case-sensitive" />
			</VSCodeButton>
			<VSCodeButton appearance="icon" aria-label="Match Whole Word">
				<span className="codicon codicon-whole-word" />
			</VSCodeButton>
			<VSCodeButton appearance="icon" aria-label="Use Regular Expression">
				<span className="codicon codicon-regex" />
			</VSCodeButton>
		</section>
	</VSCodeTextField>
)

export default TextFieldWithButtons
