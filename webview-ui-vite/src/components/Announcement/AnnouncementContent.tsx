import React from "react"

const AnnouncementContent: React.FC = () => (
	<>
		<ul style={{ margin: "0 0 8px", paddingLeft: "12px" }}>
			<li>
				New terminal emulator! When Claude runs commands, you can now type directly in the terminal (+ support
				for Python environments)
			</li>
			<li>
				<b>You can now edit Claude's changes before accepting!</b> When he edits or creates a file, you can
				modify his changes directly in the right side of the diff view (+ hover over the 'Revert Block' arrow
				button in the center to undo "<code>{"// rest of code here"}</code>" shenanigans)
			</li>
			<li>
				Adds support for reading .pdf and .docx files (try "turn my business_plan.docx into a company website")
			</li>
			<li>
				Adds new <code>search_files</code> tool that lets Claude perform regex searches in your project, making
				it easy for him to refactor code, address TODOs and FIXMEs, remove dead code, and more!
			</li>
		</ul>
	</>
)

export default AnnouncementContent
