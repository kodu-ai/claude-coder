import React from "react"
import ReactMarkdown from "react-markdown"
import rehypeRaw from "rehype-raw"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { SyntaxHighlighterStyle } from "../../utils/getSyntaxHighlighterStyleFromTheme"
import { ChevronDown, ChevronUp, AlertCircle, CheckCircle2, Info, AlertTriangle, ExternalLink } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

interface MarkdownRendererProps {
	markdown: string
	syntaxHighlighterStyle: SyntaxHighlighterStyle
}

const ThinkingContent: React.FC<{ node: any }> = ({ node }) => {
	const [isExpanded, setIsExpanded] = React.useState(false)

	return (
		<Collapsible>
			<CollapsibleTrigger
				className="flex items-center justify-between w-full p-2 bg-primary/10 rounded-t-md hover:bg-primary/20 transition-colors"
				onClick={() => setIsExpanded(!isExpanded)}
				aria-expanded={isExpanded}>
				<span className="font-semibold">Thinking Process</span>
				{isExpanded ? (
					<ChevronUp className="h-4 w-4" aria-hidden="true" />
				) : (
					<ChevronDown className="h-4 w-4" aria-hidden="true" />
				)}
			</CollapsibleTrigger>
			<CollapsibleContent>
				<ScrollArea
					viewProps={{ className: "max-h-[200px]" }}
					className=" w-full rounded-b-md bg-primary/5 p-4">
					<div className="">
						{node.children.map((child: any, index: number) => (
							<React.Fragment key={index}>{child.value}</React.Fragment>
						))}
					</div>
				</ScrollArea>
			</CollapsibleContent>
		</Collapsible>
	)
}

const CallToAction: React.FC<{ node: any }> = ({ node }) => {
	console.log(node)
	const { level, title } = node.properties
	let icon, variant
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
		<Alert variant={variant}>
			{icon}
			<AlertTitle>{title}</AlertTitle>
			<AlertDescription>
				{node.children.map((child: any, index: number) => (
					<React.Fragment key={index}>{child.value}</React.Fragment>
				))}
			</AlertDescription>
		</Alert>
	)
}

const Preview: React.FC<{ node: any }> = ({ node }) => {
	const { link } = node.properties
	return (
		<a href={link} className="p-0 my-4 rounded-md overflow-hidden flex items-center w-fit h-fit">
			<Card className="flex p-2 items-center">
				<ExternalLink className="h-4 w-4 mr-1 text-blue-500" />
				{node.children.map((child: any, index: number) => (
					<React.Fragment key={index}>{child.value}</React.Fragment>
				))}
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

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ markdown, syntaxHighlighterStyle }) => {
	console.log(markdown)
	return (
		<ReactMarkdown
			rehypePlugins={[rehypeRaw]}
			components={{
				thinking: ThinkingContent,
				"call-to-action": CallToAction,
				preview: Preview,
				p: (props) => <p className="my-2 whitespace-pre-wrap break-words" {...props} />,
				ol: (props) => <ol className="list-decimal list-inside my-2 pl-4" {...props} />,
				ul: (props) => <ul className="list-disc list-inside my-2 pl-4" {...props} />,
				code: (props) => {
					const { children, className, ...rest } = props
					const match = /language-(\w+)/.exec(className || "")
					return match ? (
						<SyntaxHighlighter
							{...rest}
							PreTag="div"
							children={String(children).replace(/\n$/, "")}
							language={match[1]}
							style={{
								...syntaxHighlighterStyle,
								'code[class*="language-"]': {
									background: "var(--vscode-editor-background)",
								},
								'pre[class*="language-"]': {
									background: "var(--vscode-editor-background)",
								},
							}}
							customStyle={{
								overflowX: "auto",
								overflowY: "hidden",
								maxWidth: "100%",
								margin: 0,
								padding: "10px",
								borderRadius: 3,
								border: "1px solid var(--vscode-sideBar-border)",
								fontSize: "var(--vscode-editor-font-size)",
								lineHeight: "var(--vscode-editor-line-height)",
								fontFamily: "var(--vscode-editor-font-family)",
							}}
						/>
					) : (
						<code {...rest} className={className}>
							{children}
						</code>
					)
				},
			}}>
			{markdown}
		</ReactMarkdown>
	)
}

export default MarkdownRenderer
