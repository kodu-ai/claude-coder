import { useAtomValue } from "jotai"
import React from "react"
import { syntaxHighlighterAtom } from "../chat-view/atoms"
import { syntaxHighlighterCustomStyle } from "../code-block/utils"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { vscDarkPlus, vs } from "react-syntax-highlighter/dist/esm/styles/prism"

export const CodeBlock: React.FC<{ children: string | React.ReactNode; language: string }> = ({
	children,
	language,
}) => {
	const syntaxHighlighter = useAtomValue(syntaxHighlighterAtom)

	return (
		<SyntaxHighlighter
			className="my-4 overflow-auto w-full p-4 font-mono text-sm"
			wrapLines={false}
			language={language || "text"} // Fallback to "text" if undefined
			style={syntaxHighlighter} // Fallback to vscDarkPlus
			customStyle={syntaxHighlighterCustomStyle}
			CodeTag="code"
			wrapLongLines
			showLineNumbers={true}>
			{String(children).replace(/\n$/, "")}
		</SyntaxHighlighter>
	)
}
