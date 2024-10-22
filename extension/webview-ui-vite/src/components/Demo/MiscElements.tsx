import {
	VSCodeBadge,
	VSCodeButton,
	VSCodeCheckbox,
	VSCodeDivider,
	VSCodeDropdown,
	VSCodeLink,
	VSCodeOption,
	VSCodePanelTab,
	VSCodePanelView,
	VSCodePanels,
	VSCodeProgressRing,
	VSCodeRadio,
	VSCodeRadioGroup,
	VSCodeTag,
	VSCodeTextArea,
	VSCodeTextField,
} from '@vscode/webview-ui-toolkit/react'
import type React from 'react'

const MiscElements: React.FC = () => (
	<>
		<span className="flex gap-3">
			<VSCodeProgressRing />
			<VSCodeTextField />
			<VSCodeButton>Add</VSCodeButton>
			<VSCodeButton appearance="secondary">Remove</VSCodeButton>
		</span>

		<VSCodeBadge>Badge</VSCodeBadge>
		<VSCodeCheckbox>Checkbox</VSCodeCheckbox>
		<VSCodeDivider />
		<VSCodeDropdown>
			<VSCodeOption>Option 1</VSCodeOption>
			<VSCodeOption>Option 2</VSCodeOption>
		</VSCodeDropdown>
		<VSCodeLink href="#">Link</VSCodeLink>
		<VSCodePanels>
			<VSCodePanelTab id="tab-1">Tab 1</VSCodePanelTab>
			<VSCodePanelTab id="tab-2">Tab 2</VSCodePanelTab>
			<VSCodePanelView id="view-1">Panel View 1</VSCodePanelView>
			<VSCodePanelView id="view-2">Panel View 2</VSCodePanelView>
		</VSCodePanels>
		<VSCodeRadioGroup>
			<VSCodeRadio>Radio 1</VSCodeRadio>
			<VSCodeRadio>Radio 2</VSCodeRadio>
		</VSCodeRadioGroup>
		<VSCodeTag>Tag</VSCodeTag>
		<VSCodeTextArea placeholder="Text Area" />
	</>
)

export default MiscElements
