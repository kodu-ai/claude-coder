import { useAtomValue } from "jotai"
import React from "react"
import { syntaxHighlighterAtom } from "../chat-view/atoms"
import { syntaxHighlighterCustomStyle } from "../code-block/utils"
import SyntaxHighlighter from "react-syntax-highlighter"
import { oneDark, vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism"

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
			className="my-4 mx-4 overflow-auto w-[calc(100%-2rem)] p-4 font-mono text-base rounded-lg"
			wrapLines={false}
			language={language}
			style={syntaxHighlighter}
			customStyle={syntaxHighlighterCustomStyle}
			// PreTag="div"
			// CodeTag="code"
			wrapLongLines
			showLineNumbers={true}>
			{String(children).replace(/\n$/, "")}
		</SyntaxHighlighter>
	)
}
