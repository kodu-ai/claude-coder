import React from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeRaw from "rehype-raw"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
// You can choose another theme from react-syntax-highlighter/dist/cjs/styles/prism
import { vscDarkPlus } from "react-syntax-highlighter/dist/cjs/styles/prism"
import { useAtomValue } from "jotai"
import { syntaxHighlighterAtom } from "../chat-view/atoms"

// Example interface, you can customize as needed
interface MarkdownRendererProps {
	markdown: string
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ markdown }) => {
	const syntaxHighlighter = useAtomValue(syntaxHighlighterAtom)
	return (
		<div className="mr-auto p-4 py-0">
			<div className="prose prose-sm sm:prose-base lg:prose-lg dark:prose-invert max-w-none">
				<ReactMarkdown
					// GFM adds support for tables, strikethrough, and task lists
					remarkPlugins={[remarkGfm]}
					// Allows rendering raw HTML in the markdown content (use with caution)
					rehypePlugins={[rehypeRaw]}
					components={{
						// Customize code blocks
						code: ({ node, className, children, ...props }) => {
							const match = /language-(\w+)/.exec(className || "")
							if (match) {
								// This is a fenced code block with a language
								return (
									<SyntaxHighlighter
										language={match[1]}
										style={syntaxHighlighter}
										PreTag="div"
										CodeTag="code"
										// Tailwind classes for spacing, background, rounding
										className="my-4 overflow-auto rounded-lg bg-gray-900 p-4 font-mono text-sm"
										showLineNumbers={false}>
										{String(children).replace(/\n$/, "")}
									</SyntaxHighlighter>
								)
							} else {
								// Inline code block
								return (
									<code className="rounded bg-gray-100 dark:bg-gray-800 px-1 py-0.5 font-mono text-sm">
										{children}
									</code>
								)
							}
						},
						// Customize images to be responsive and rounded
						img: ({ node, ...props }) => (
							<img
								{...props}
								className="rounded-lg border border-gray-300 dark:border-gray-700 max-w-full h-auto"
							/>
						),
						// Example customization for blockquotes
						blockquote: ({ node, ...props }) => (
							<blockquote
								{...props}
								className="mt-6 border-l-4 border-gray-300 dark:border-gray-700 pl-4 italic text-gray-600 dark:text-gray-300"
							/>
						),
						// You can override other elements as needed, but `prose` handles most gracefully.
					}}>
					{markdown}
				</ReactMarkdown>
			</div>
		</div>
	)
}

export default MarkdownRenderer