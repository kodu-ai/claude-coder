import { extractAdditionalContext, extractFilesFromContext, extractUrlsFromContext } from "@/utils/extractAttachments"
import React, { useEffect, useRef, useState } from "react"
import { useWindowSize } from "react-use"
import AttachmentsList, { FileItem, UrlItem } from "../ChatRow/FileList"
import { Button } from "../ui/button"
import { cn } from "@/lib/utils"

interface TaskTextProps {
	text?: string
}

function splitString(input: string) {
	const regex = /<additional-context>\[(.*?)\]<\/additional-context>/
	const match = input.match(regex)

	if (match) {
		const additionalContent = match[1]
		const mainContent = input.replace(match[0], "").trim()

		return {
			mainContent,
			additionalContent,
		}
	} else {
		return {
			mainContent: input,
			additionalContent: null,
		}
	}
}

const TaskText: React.FC<TaskTextProps> = ({ text }) => {
	const [isExpanded, setIsExpanded] = useState(false)
	const [showSeeMore, setShowSeeMore] = useState(false)
	const textContainerRef = useRef<HTMLDivElement>(null)
	const textRef = useRef<HTMLDivElement>(null)
	const showMoreVis = (!isExpanded && showSeeMore) || (isExpanded && showSeeMore)
	const { height: windowHeight, width: windowWidth } = useWindowSize()

	useEffect(() => {
		if (isExpanded && textContainerRef.current) {
			const maxHeight = windowHeight * (1 / 2)
			textContainerRef.current.style.maxHeight = `${maxHeight}px`
		}
	}, [isExpanded, windowHeight])

	useEffect(() => {
		if (textRef.current && textContainerRef.current) {
			let textContainerHeight = textContainerRef.current.clientHeight
			if (!textContainerHeight) {
				textContainerHeight = textContainerRef.current.getBoundingClientRect().height
			}
			const isOverflowing = textRef.current.scrollHeight > textContainerHeight
			if (!isOverflowing) {
				setIsExpanded(false)
			}
			setShowSeeMore(isOverflowing)
		}
	}, [text, windowWidth])

	const toggleExpand = () => setIsExpanded(!isExpanded)
	const parts = extractAdditionalContext(text || "")
	let filesCut: FileItem[] = []
	const textLines = parts[0].split("\n")
	if (parts[1]) {
		filesCut = extractFilesFromContext(parts[1])
	}
	let urlsCut: UrlItem[] = []
	if (parts[1]) {
		urlsCut = extractUrlsFromContext(parts[1])
	}

	return (
		<>
			<div
				ref={textContainerRef}
				className="w-full relative"
				style={{
					fontSize: "var(--vscode-font-size)",
					overflowY: isExpanded ? "auto" : "hidden",
					wordBreak: "break-word",
					overflowWrap: "anywhere",
					position: "relative",
				}}>
				<div
					ref={textRef}
					style={{
						display: "-webkit-box",
						WebkitLineClamp: isExpanded ? "unset" : 3,
						WebkitBoxOrient: "vertical",
						overflow: "hidden",
						whiteSpace: "pre-wrap",
						wordBreak: "break-word",
						overflowWrap: "anywhere",
					}}>
					{isExpanded ? textLines.slice(0, -1).join("\n").trim() : textLines.join("\n").trim()}
					{/* last line give it a minor padding-right of 40px */}
					{textLines.length > 2 && (
						<>
							<br />
							<span className="pr-10">{textLines[textLines.length - 1]}</span>
						</>
					)}
				</div>
				<AttachmentsList files={filesCut} urls={urlsCut} />

				<div
					className={cn(
						showMoreVis ? "block" : "hidden",
						"ml-auto mt-auto text-right w-fit mb-2",
						"absolute bottom-0 right-0 mb-0 bg-background z-10 pl-1"
					)}>
					<Button variant="link" size="sm" className="shrink-0" onClick={toggleExpand}>
						{isExpanded ? "see less" : "see more"}
					</Button>
				</div>
			</div>
		</>
	)
}

export default TaskText
