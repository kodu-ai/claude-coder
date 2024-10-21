import { cn } from "@/lib/utils"
import { extractAdditionalContext, extractFilesFromContext, extractUrlsFromContext } from "@/utils/extractAttachments"
import React, { useEffect, useRef, useState } from "react"
import { useWindowSize } from "react-use"
import AttachmentsList, { FileItem, UrlItem } from "../ChatRow/FileList"
import { Button } from "../ui/button"

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
	// split by new line or end of line this can all be one long line so we need to account for that
	const textLines = parts[0]?.split(/\n|\r/)
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
					{isExpanded ? (textLines.length > 0 ? textLines.join("\n") : parts[0]?.trim()) : parts[0]?.trim()}

					{/* Remove the last line padding */}
				</div>
				<AttachmentsList files={filesCut} urls={urlsCut} />

				{isExpanded && (
					<div className="text-right mt-1 mr-2">
						<Button variant="link" size="lg" className="shrink-0" onClick={toggleExpand}>
							see less
						</Button>
					</div>
				)}
			</div>
			{!isExpanded && showSeeMore && (
				<div className="text-right mt-1 mr-2">
					<Button variant="link" size="lg" className="shrink-0" onClick={toggleExpand}>
						see more
					</Button>
				</div>
			)}
		</>
	)
}

export default TaskText
