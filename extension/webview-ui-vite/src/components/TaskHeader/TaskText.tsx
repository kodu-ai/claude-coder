import { extractAdditionalContext, extractFilesFromContext, extractUrlsFromContext } from "@/utils/extractAttachments";
import React, { useEffect, useRef, useState } from "react";
import { useWindowSize } from "react-use";
import AttachmentsList, { FileItem, UrlItem } from "../ChatRow/FileList";

interface TaskTextProps {
	text?: string
}

function splitString(input: string) {
  const regex = /<additional-context>\[(.*?)\]<\/additional-context>/;
  const match = input.match(regex);

  if (match) {
    const additionalContent = match[1];
    const mainContent = input.replace(match[0], '').trim();

    return {
      mainContent,
      additionalContent,
    };
  } else {
    return {
      mainContent: input,
      additionalContent: null,
    };
  }
}

const TaskText: React.FC<TaskTextProps> = ({ text }) => {
	const [isExpanded, setIsExpanded] = useState(false)
	const [showSeeMore, setShowSeeMore] = useState(false)
	const textContainerRef = useRef<HTMLDivElement>(null)
	const textRef = useRef<HTMLDivElement>(null)

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
	const parts = extractAdditionalContext(text || '');
	let filesCut: FileItem[] = []
	if (parts[1]) {
		filesCut = extractFilesFromContext(parts[1]);
	}
	let urlsCut: UrlItem[] = []
	if (parts[1]) {
		urlsCut = extractUrlsFromContext(parts[1]);
	}

	return (
		<>
			<div
				ref={textContainerRef}
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
					{parts[0].trim()}
				</div>
				{!isExpanded && showSeeMore && (
					<div
						style={{
							position: "absolute",
							right: 0,
							bottom: 0,
							display: "flex",
							alignItems: "center",
						}}>
						<div
							style={{
								width: 30,
								height: "1.2em",
								background: "linear-gradient(to right, transparent, var(--section-border))",
							}}
						/>
						<div
							style={{
								cursor: "pointer",
								color: "var(--vscode-textLink-foreground)",
								paddingRight: 0,
								paddingLeft: 3,
								backgroundColor: "var(--section-border)",
							}}
							onClick={toggleExpand}>
							See more
						</div>
					</div>
				)}
			</div>
				<AttachmentsList files={filesCut} urls={urlsCut} />
				
			{isExpanded && showSeeMore && (
				<div
					style={{
						cursor: "pointer",
						color: "var(--vscode-textLink-foreground)",
						marginLeft: "auto",
						textAlign: "right",
						paddingRight: 0,
					}}
					onClick={toggleExpand}>
					See less
				</div>
			)}
		</>
	)
}

export default TaskText
