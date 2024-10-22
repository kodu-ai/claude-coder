import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { AlertCircle, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, ExternalLink, Info } from "lucide-react"
import React from "react"
import ReactMarkdown from "react-markdown"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import rehypeRaw from "rehype-raw"
import { SyntaxHighlighterStyle } from "../../utils/getSyntaxHighlighterStyleFromTheme"
import CodeBlock from "../CodeBlock/CodeBlock"

interface MarkdownRendererProps {
	markdown: string
	syntaxHighlighterStyle: SyntaxHighlighterStyle
}

const extractTextContent = (node: any): string => {
	if (typeof node === "string") return node
	if (typeof node.value === "string") return node.value
	if (Array.isArray(node.children)) {
		return node.children.map(extractTextContent).join("")
	}
	return ""
}

const ThinkingContent: React.FC<{ node: any; rendererProps: MarkdownRendererProps }> = ({ node, rendererProps }) => {
	const [isExpanded, setIsExpanded] = React.useState(false)
	const textContent = extractTextContent(node)

	return (
		<Collapsible defaultOpen className="w-full">
			<CollapsibleTrigger
				className="flex items-center justify-between w-full p-2 bg-primary/10 rounded-t-md hover:bg-primary/20 transition-colors flex-grow basis-full"
				onClick={() => setIsExpanded(!isExpanded)}
				aria-expanded={isExpanded}>
				<span className="font-semibold">Thinking Process</span>
				{isExpanded ? (
					<ChevronUp className="h-4 w-4" aria-hidden="true" />
				) : (
					<ChevronDown className="h-4 w-4" aria-hidden="true" />
				)}
			</CollapsibleTrigger>
			<CollapsibleContent className="w-full">
				<ScrollArea
					viewProps={{ className: "max-h-[200px] pt-4" }}
					className="w-full rounded-b-md bg-primary/5 p-4 pt-0">
					<div className="whitespace-pre text-pretty">{textContent.trim()}</div>
					<ScrollBar forceMount />
				</ScrollArea>
			</CollapsibleContent>
		</Collapsible>
	)
}

const CallToAction: React.FC<{ node: any; rendererProps: MarkdownRendererProps }> = ({ node, rendererProps }) => {
	const { level, title } = node.properties
	let icon, variant
	const textContent = extractTextContent(node)

	switch (level) {
		case "success":
			icon = <CheckCircle2 className="h-4 w-4" />
			variant = "success"
			break
		case "warning":
			icon = <AlertTriangle className="h-4 w-4" />
			variant = "warning"
			break
		case "error":
			icon = <AlertCircle className="h-4 w-4" />
			variant = "destructive"
			break
		default:
			icon = <Info className="h-4 w-4" />
			variant = "info"
	}

	return (
		<Alert variant={variant as any}>
			{icon}
			<AlertTitle>{title}</AlertTitle>
			<AlertDescription>
				<div className="whitespace-pre-wrap">{textContent}</div>
			</AlertDescription>
		</Alert>
	)
}

const Preview: React.FC<{ node: any }> = ({ node }) => {
	const { link } = node.properties
	const textContent = extractTextContent(node)

	return (
		<a href={link} className="p-0 my-4 rounded-md overflow-hidden flex items-center w-fit h-fit">
			<Card className="flex p-2 items-center">
				<ExternalLink className="h-4 w-4 mr-1 text-blue-500" />
				<div className="whitespace-pre-wrap">{textContent}</div>
				<div></div>
			</Card>
		</a>
	)
}

const CustomButton: React.FC<{ node: any }> = ({ node }) => {
	return (
		<Button className="my-2">
			{node.children.map((child: any, index: number) => (
				<React.Fragment key={index}>{child.value}</React.Fragment>
			))}
		</Button>
	)
}

const WriteToFile: React.FC<{ node: any; syntaxHighlighterStyle: SyntaxHighlighterStyle }> = ({
	node,
	syntaxHighlighterStyle,
}) => {
	const [isExpanded, setIsExpanded] = React.useState(false)
	const textContent = extractTextContent(node)
	return (
		<>
			<h3 className="flex-line text-alt">
				<span className={`codicon codicon-new-file text-alt`} />
				Claude wants to create a new file:
			</h3>
			<CodeBlock
				code={textContent}
				path={node.properties.path}
				syntaxHighlighterStyle={syntaxHighlighterStyle}
				isExpanded={isExpanded}
				onToggleExpand={() => setIsExpanded(!isExpanded)}
			/>
		</>
	)
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ markdown, syntaxHighlighterStyle }) => {
	return (
		<ReactMarkdown
			rehypePlugins={[rehypeRaw]}
			components={{
				// @ts-expect-error not typed
				thinking: ThinkingContent,
				preview: Preview,
				write_to_file: WriteToFile,
				"call-to-action": CallToAction,
				// "write-to-file": (props) => <WriteToFile {...props} syntaxHighlighterStyle={syntaxHighlighterStyle} />,
				p: (props) => <p className="my-1 leading-6 text-wrap whitespace-pre" {...props} />,
				ol: (props) => <ol className="list-decimal list-inside pl-4 space-y-2" {...props} />,
				ul: (props) => <ul className="list-disc list-inside my-4 pl-6 space-y-2" {...props} />,
				li: (props) => <li style={{ listStyle: "auto!important" }} className="mb-1 list item" {...props} />,
				h1: (props) => (
					<h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl" {...props} />
				),
				h2: (props) => (
					<h2
						className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight transition-colors first:mt-0"
						{...props}
					/>
				),
				h3: (props) => <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight" {...props} />,
				a: (props) => <a className="font-medium text-primary underline underline-offset-4" {...props} />,
				blockquote: (props) => <blockquote className="mt-6 border-l-2 pl-6 italic" {...props} />,
				// @ts-expect-error not typed
				code: ({ node, inline, className, children, ...props }) => {
					const match = /language-(\w+)/.exec(className || "")
					return !inline && match ? (
						// @ts-expect-error not typed
						<SyntaxHighlighter
							{...props}
							children={String(children).replace(/\n$/, "")}
							language={match[1]}
							PreTag="div"
							style={syntaxHighlighterStyle}
							customStyle={{
								margin: "1rem 0",
								padding: "1rem",
								borderRadius: "0.375rem",
								fontSize: "0.875rem",
								lineHeight: "1.7142857",
							}}
						/>
					) : (
						<code
							className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold"
							{...props}>
							{children}
						</code>
					)
				},
				span: (props) => <span className="text-wrap whitespace-pre" {...props} />,
				pre: (props) => <pre className="overflow-auto p-4 rounded-lg my-4 bg-muted" {...props} />,
			}}>
			{markdown}
		</ReactMarkdown>
	)
}

export default MarkdownRenderer
