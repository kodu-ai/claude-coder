import React, { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Edit, Undo2, ExternalLink, AlertTriangle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { vscode } from "@/utils/vscode"
import { WriteToFileTool } from "../../../../../src/shared/new-tools"
import { ToolAddons, ToolBlock } from "../chat-tools"
import { memo } from "react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

// Animation variants for the streaming text
const textVariants = {
	hidden: { opacity: 0, y: 20 },
	visible: { opacity: 1, y: 0 },
}

const CHUNK_SIZE = 50

export const FileEditorTool: React.FC<WriteToFileTool & ToolAddons> = memo(
	({
		path,
		content,
		approvalState,

		tool,
		ts,
		mode = "whole",
		notAppliedCount = 0,
		branch,
		commitHash,
		...rest
	}) => {
		content = content ?? ""
		const [visibleContent, setVisibleContent] = useState<string[]>([])
		const [totalLines, setTotalLines] = useState(0)
		const [isRollbackDialogOpen, setIsRollbackDialogOpen] = useState(false)
		const isStreaming = approvalState === "loading"
		const scrollAreaRef = useRef<HTMLDivElement>(null)
		const lastChunkRef = useRef<HTMLPreElement>(null)
		const animationCompleteCountRef = useRef(0)

		useEffect(() => {
			const text = content ?? ""
			setTotalLines(text.split("\n").length)

			if (isStreaming) {
				const chunks = text.match(new RegExp(`.{1,${CHUNK_SIZE * 2}}`, "g")) || []
				setVisibleContent(chunks)
			} else {
				setVisibleContent([text])
			}

			animationCompleteCountRef.current = 0
		}, [content, isStreaming])

		// Handler for the rollback action
		const handleRollback = () => {
			if (!commitHash || !branch) return
			vscode.postMessage({
				type: "rollbackToCheckpoint",
				ts,
				commitHash,
				branch,
			})
			setIsRollbackDialogOpen(false)
		}

		// Handler for viewing the file
		const handleViewFile = () => {
			console.log("handleViewFile", {
				commitHash,
				branch,
				path,
			})
			if (!commitHash || !branch) return
			vscode.postMessage({
				type: "viewFile",
				path,
				branch,
				commitHash,
			})
		}

		return (
			<ToolBlock
				{...rest}
				ts={ts}
				tool={tool}
				icon={Edit}
				title="Write to File"
				variant="info"
				approvalState={approvalState}>
				<div className="flex flex-col space-y-2">
					{/* File info and badges section */}
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2 flex-wrap">
							<p className="text-xs">
								<span className="font-semibold">File:</span> {path}
							</p>
							<Badge variant={mode === "inline" ? "secondary" : "outline"}>
								{mode === "inline" ? "Inline Edit" : "Full File"}
							</Badge>
							{notAppliedCount > 0 && (
								<Badge variant="destructive" className="animate-pulse">
									{notAppliedCount} changes not applied
								</Badge>
							)}
						</div>
					</div>

					{/* Git info section */}
					{(branch || commitHash) && (
						<div className="flex items-center space-x-2 text-xs text-muted-foreground">
							{branch && <span>Branch: {branch}</span>}
							{commitHash && <span>Commit: {commitHash.slice(0, 7)}</span>}
						</div>
					)}

					{/* Content scroll area */}
					<ScrollArea viewProps={{ ref: scrollAreaRef }} className="h-24 rounded border bg-background p-2">
						<ScrollBar orientation="vertical" />
						<ScrollBar orientation="horizontal" />
						<div className="relative">
							{isStreaming && (
								<motion.div
									className="sticky left-0 top-0 w-full h-1 bg-primary"
									initial={{ scaleX: 0 }}
									animate={{ scaleX: 1 }}
									transition={{
										repeat: Infinity,
										duration: 2,
										ease: "linear",
									}}
								/>
							)}
							{!isStreaming ? (
								<pre className="font-mono text-xs text-white whitespace-pre-wrap overflow-hidden">
									{content?.trim() ?? ""}
								</pre>
							) : (
								<AnimatePresence>
									{visibleContent.map((chunk, index) => (
										<motion.pre
											key={index}
											ref={index === visibleContent.length - 1 ? lastChunkRef : null}
											variants={textVariants}
											initial="hidden"
											animate="visible"
											transition={{ duration: 0.3, delay: index * 0.03 }}
											className="font-mono text-xs text-white whitespace-pre-wrap overflow-hidden">
											{index === 0 ? chunk.trim() : chunk}
										</motion.pre>
									))}
								</AnimatePresence>
							)}
						</div>
					</ScrollArea>

					{/* Status and actions footer */}
					<div className="flex justify-between items-center">
						<span className="text-xs text-muted-foreground shrink-1">
							{isStreaming ? "Streaming..." : `${totalLines} lines written`}
						</span>
						<div className="flex gap-2  grow-1 max-[288px]:flex-wrap max-[288px]:justify-end">
							{(!commitHash || !branch) && (
								<Tooltip>
									<TooltipTrigger asChild>
										<span>
											<Button
												variant="outline"
												size="sm"
												disabled
												className="flex items-center space-x-1 w-[94px]">
												<ExternalLink className="w-4 h-4" />
												<span>View File</span>
											</Button>
										</span>
									</TooltipTrigger>
									<TooltipContent>Requires Git handler to be enabled.</TooltipContent>
								</Tooltip>
							)}
							{commitHash && branch && (
								<Button
									variant="outline"
									size="sm"
									onClick={handleViewFile}
									className="flex items-center space-x-1 w-[94px]">
									<ExternalLink className="w-4 h-4" />
									<span>View File</span>
								</Button>
							)}
							{(!commitHash || !branch) && (
								<Tooltip>
									<TooltipTrigger asChild>
										<span>
											<Button
												variant="destructive"
												size="sm"
												disabled
												className="flex items-center space-x-1 w-[94px]">
												<Undo2 className="w-4 h-4" />
												<span>Rollback</span>
											</Button>
										</span>
									</TooltipTrigger>
									<TooltipContent>Requires Git handler to be enabled.</TooltipContent>
								</Tooltip>
							)}
							{commitHash && branch && (
								<Button
									variant="destructive"
									size="sm"
									onClick={() => setIsRollbackDialogOpen(true)}
									className="flex items-center space-x-1 w-[94px]">
									<Undo2 className="w-4 h-4" />
									<span>Rollback</span>
								</Button>
							)}
						</div>
					</div>
				</div>

				{/* Rollback confirmation dialog */}
				<AlertDialog open={isRollbackDialogOpen} onOpenChange={setIsRollbackDialogOpen}>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle className="flex items-center space-x-2">
								<AlertTriangle className="w-5 h-5 text-destructive" />
								<span>Confirm Rollback</span>
							</AlertDialogTitle>
							<AlertDialogDescription>
								This action will reset the entire conversation and all file changes back to this
								checkpoint. This is irreversible and any changes made after this point will be lost. Are
								you sure you want to continue?
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel>Cancel</AlertDialogCancel>
							<Button variant="destructive" asChild>
								<AlertDialogAction onClick={handleRollback}>Yes, Roll Back</AlertDialogAction>
							</Button>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			</ToolBlock>
		)
	},
	(prevProps, nextProps) => {
		return (
			prevProps.approvalState === nextProps.approvalState &&
			prevProps.content === nextProps.content &&
			prevProps.ts === nextProps.ts &&
			prevProps.path === nextProps.path &&
			prevProps.notAppliedCount === nextProps.notAppliedCount &&
			prevProps.mode === nextProps.mode &&
			prevProps.branch === nextProps.branch &&
			prevProps.commitHash === nextProps.commitHash
		)
	}
)
