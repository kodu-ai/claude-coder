import { VSCodeButton } from '@vscode/webview-ui-toolkit/react'
import type React from 'react'
import DataGridDemo from './DataGridDemo'
import MiscElements from './MiscElements'
import TextFieldWithButtons from './TextFieldWithButtons'

const Demo: React.FC = () => {
	return (
		<main>
			<h1>Hello World!</h1>
			<VSCodeButton>Howdy!</VSCodeButton>

			<div className="grid gap-3 p-2 place-items-start">
				<DataGridDemo />
				<TextFieldWithButtons />
				<MiscElements />
			</div>
		</main>
	)
}

export default Demo
