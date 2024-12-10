import React from "react"

export const formatDate = (timestamp: number): string => {
	const date = new Date(timestamp)
	return date
		?.toLocaleString("en-US", {
			month: "long",
			day: "numeric",
			hour: "numeric",
			minute: "2-digit",
			hour12: true,
		})
		.replace(", ", " ")
		.replace(" at", ",")
		.toUpperCase()
}

export const highlightText = (text: string, query: string): React.ReactNode => {
	if (!query) return text
	const parts = text.split(new RegExp(`(${query})`, "gi"))
	return parts.map((part, index) =>
		part.toLowerCase() === query.toLowerCase() ? (
			<mark
				key={index}
				style={{ backgroundColor: "var(--vscode-editor-findMatchHighlightBackground)", color: "inherit" }}>
				{part}
			</mark>
		) : (
			part
		)
	)
}
