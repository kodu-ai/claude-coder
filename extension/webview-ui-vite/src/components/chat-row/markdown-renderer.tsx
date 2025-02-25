import React from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeRaw from "rehype-raw"
import SyntaxHighlighter from "react-syntax-highlighter"
// You can choose another theme from react-syntax-highlighter/dist/cjs/styles/prism
import { vscDarkPlus } from "react-syntax-highlighter/dist/cjs/styles/prism"
import { useAtomValue } from "jotai"
import { syntaxHighlighterAtom } from "../chat-view/atoms"
import { syntaxHighlighterCustomStyle } from "../code-block/utils"
import { CodeBlock } from "./code-block"

// Example interface, you can customize as needed
type MarkdownRendererProps =
	| {
			markdown: string
			children?: string
	  }
	| {
			markdown?: string
			children: string
	  }

function cleanMarkdown(markdown?: string) {
	if (!markdown) return ""
	const tags = ["kodu_action", "thinking", "observation", "thinking_summary", "execution_plan"]

	for (const tag of tags) {
		const openTag = `<${tag}>`
		const closeTag = `</${tag}>`
		markdown = markdown.replaceAll(openTag, ``)
		markdown = markdown.replaceAll(closeTag, ``)
	}
	return markdown
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ markdown, children }) => {
	markdown = cleanMarkdown(markdown ?? children)
	return (
		<div className="mr-auto p-4 py-0 overflow-hidden">
			<div className="prose prose-sm sm:prose-base lg:prose-lg dark:prose-invert max-w-none w-full space-y-1 break-normal whitespace-normal">
				<ReactMarkdown
					rehypePlugins={[rehypeRaw]}
					// GFM adds support for tables, strikethrough, and task lists
					remarkPlugins={[remarkGfm]}
					// Allows rendering raw HTML in the markdown content (use with caution)
					components={{
						p: ({ node, ...props }) => <p {...props} className="mb-2" />,
						h1: ({ node, ...props }) => <h1 {...props} className="text-2xl font-bold mb-2" />,
						h2: ({ node, ...props }) => <h2 {...props} className="text-xl font-bold mb-2" />,
						h3: ({ node, ...props }) => <h3 {...props} className="text-lg font-bold mb-2" />,
						h4: ({ node, ...props }) => <h4 {...props} className="text-base font-bold mb-2" />,
						h5: ({ node, ...props }) => <h5 {...props} className="text-sm font-bold mb-2" />,
						span: ({ node, ...props }) => <span {...props} className="text-base" />,
						// Customize code blocks
						code: ({ node, className, children, ...props }) => {
							const match = /language-(\w+)/.exec(className || "")
							console.log("match", match)
							console.log(node)

							if (match) {
								// This is a fenced code block with a language
								return <CodeBlock language={match[1]}>{children}</CodeBlock>
							} else {
								// Inline code block
								return (
									<code className="rounded bg-gray-100 dark:bg-gray-800 px-1 py-0.5 font-mono text-sm overflow-auto">
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
