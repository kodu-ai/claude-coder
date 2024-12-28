export const removeLeadingNonAlphanumeric = (path: string): string => path.replace(/^[^a-zA-Z0-9]+/, "")

export const containerStyle: React.CSSProperties = {
	borderRadius: "3px",
	backgroundColor: "var(--vscode-editor-background)",
	overflow: "hidden",
	border: "1px solid var(--section-border)",
}

export const pathHeaderStyle: React.CSSProperties = {
	color: "var(--vscode-descriptionForeground)",
	display: "flex",
	justifyContent: "space-between",
	alignItems: "center",
	padding: "6px 10px",
	cursor: "pointer",
}

export const pathTextStyle: React.CSSProperties = {
	whiteSpace: "nowrap",
	overflow: "hidden",
	textOverflow: "ellipsis",
	marginRight: "8px",
	fontSize: "11px",
	direction: "rtl",
	textAlign: "left",
}

export const codeContainerStyle: React.CSSProperties = {
	overflowX: "auto",
	overflowY: "hidden",
	maxWidth: "100%",
}

export const syntaxHighlighterCustomStyle: React.CSSProperties = {
	margin: 0,
	padding: "6px 10px",
	// minWidth: "max-content",
	borderRadius: 0,
	fontSize: "var(--vscode-editor-font-size)",
	lineHeight: "var(--vscode-editor-line-height)",
	fontFamily: "var(--vscode-editor-font-family)",
}
