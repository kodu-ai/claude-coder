import { useAtomValue } from "jotai"
import React from "react"
import { syntaxHighlighterAtom } from "../chat-view/atoms"
import { syntaxHighlighterCustomStyle } from "../code-block/utils"
import SyntaxHighlighter from "react-syntax-highlighter"

export const CodeBlock: React.FC<{ children: string | React.ReactNode; language: string }> = ({
	children,
	language,
}) => {
	const syntaxHighlighter = useAtomValue(syntaxHighlighterAtom)

	return (
		<SyntaxHighlighter
			// language={codeLanguage ?? match?.[1]}
			// style={syntaxHighlighter}
			// PreTag="div"
			// CodeTag="code"
			// // Tailwind classes for spacing, background, rounding
			className="my-4 overflow-auto rounded-lg bg-gray-900 p-4 font-mono text-sm"
			wrapLines={false}
			language={language}
			style={syntaxHighlighter}
			customStyle={syntaxHighlighterCustomStyle}
			PreTag="div"
			CodeTag="code"
			showLineNumbers={true}>
			{String(children).replace(/\n$/, "")}
		</SyntaxHighlighter>
	)
}
