import React from "react"
import { VSCodeRadioGroup, VSCodeRadio } from "@vscode/webview-ui-toolkit/react"
import { SetStateAction } from "jotai"
import { creativeModeAtom } from "../../context/ExtensionStateContext"

interface CreativityModeSelectorProps {
	creativeMode: string
	setCreativeMode: (mode: "creative" | "normal" | "deterministic") => void
}

const modeDescriptions = {
	normal: "Balanced creativity and consistency in code generation.",
	deterministic: "Produces consistent code generation and similar coding style.",
	creative:
		"Generates more varied and imaginative coding style, might produce unexpected results. and sometimes might solve tasks that are not solvable in other modes.",
}

const CreativityModeSelector: React.FC<CreativityModeSelectorProps> = ({ creativeMode, setCreativeMode }) => (
	<div className="creativity-mode-selector" style={{ marginBottom: 5 }}>
		<span style={{ fontWeight: "500" }}>Select Creativity Mode:</span>
		<VSCodeRadioGroup value={creativeMode} onChange={(e: any) => setCreativeMode(e.target.value)}>
			<VSCodeRadio value="normal">Normal</VSCodeRadio>
			<VSCodeRadio value="deterministic">Deterministic</VSCodeRadio>
			<VSCodeRadio value="creative">Creative</VSCodeRadio>
		</VSCodeRadioGroup>
		<p
			style={{
				fontSize: "12px",
				marginTop: "5px",
				color: "var(--vscode-descriptionForeground)",
			}}>
			{modeDescriptions[creativeMode as keyof typeof modeDescriptions]}
		</p>
	</div>
)

export default CreativityModeSelector
