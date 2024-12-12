import React, { useMemo, useState } from "react"
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
import { FileEditorTool as FileEditorToolParams } from "../../../../../src/shared/new-tools"
import { ToolAddons, ToolBlock } from "../chat-tools"
import { memo } from "react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import MarkdownRenderer from "../markdown-renderer"

type ApprovalState = ToolAddons["approvalState"]

export const FileEditorTool: React.FC<FileEditorToolParams & ToolAddons> = memo(
	({
		path,
		mode = "whole_write",
		kodu_content,
		kodu_diff,
		list_versions_output,
		rollback_version,
		notAppliedCount = 0,
		approvalState,
		tool,
		ts,
		...rest
	}) => {
		const isViewOrRollbackPossible = useMemo(
			() => (mode === "whole_write" || mode === "edit") && rest.saved_version,
			[mode, rest.saved_version]
		)
		const [isRollbackDialogOpen, setIsRollbackDialogOpen] = useState(false)

		// Determine displayed content
		let displayedContent = ""
		if (mode === "list_versions" && list_versions_output) {
			displayedContent = list_versions_output
		} else if (kodu_content) {
			displayedContent = kodu_content
		} else if (kodu_diff) {
			displayedContent = kodu_diff
		} else {
			displayedContent = ""
		}

		const totalLines = displayedContent.split("\n").length

		const handleRollback = () => {
			if (!rest.saved_version) return
			vscode.postMessage({
				type: "rollbackToCheckpoint",
				path,
				version: rest.saved_version,
				ts,
			})
			setIsRollbackDialogOpen(false)
		}

		const handleViewFile = () => {
			if (rest.saved_version) {
				vscode.postMessage({
					type: "viewFile",
					path,
					version: rest.saved_version,
				})
			}
		}

		// Determine mode label
		let modeLabel = ""
		switch (mode) {
			case "edit":
				modeLabel = "Edit"
				break
			case "whole_write":
				modeLabel = "Whole File"
				break
			case "rollback":
				modeLabel = "Rollback"
				break
			case "list_versions":
				modeLabel = "List Versions"
				break
			default:
				modeLabel = "Unknown"
		}

		return (
			<ToolBlock
				{...rest}
				ts={ts}
				tool={tool}
				icon={Edit}
				title="File Editor"
				variant="info"
				approvalState={approvalState}>
				<div className="flex flex-col space-y-2">
					<div className="flex items-center gap-2 flex-wrap">
						<p className="text-xs">
							<span className="font-semibold">File:</span> {path}
						</p>
						<Badge variant="outline">{modeLabel}</Badge>
						{notAppliedCount > 0 && (
							<Badge variant="destructive" className="animate-pulse">
								{notAppliedCount} changes not applied
							</Badge>
						)}
					</div>

					<ScrollArea className="h-24 rounded border bg-background p-2">
						<ScrollBar orientation="vertical" />
						<ScrollBar orientation="horizontal" />
						<pre className="font-mono text-xs text-white whitespace-pre-wrap overflow-hidden">
							<MarkdownRenderer markdown={displayedContent?.trim()} />
						</pre>
					</ScrollArea>

					<div className="flex justify-between items-center">
						<span className="text-xs text-muted-foreground">{`${totalLines} lines`}</span>
						<div className="flex gap-2 flex-wrap justify-end">
							<Button
								variant="outline"
								size="sm"
								disabled={!isViewOrRollbackPossible}
								onClick={handleViewFile}
								className="flex items-center space-x-1 w-[94px]">
								<ExternalLink className="w-4 h-4" />
								<span>View File</span>
							</Button>
							<Button
								variant="destructive"
								size="sm"
								// temporary disabled
								disabled={true}
								onClick={() => setIsRollbackDialogOpen(true)}
								className="flex items-center space-x-1 w-[94px]">
								<Undo2 className="w-4 h-4" />
								<span>Rollback</span>
							</Button>
						</div>
					</div>
				</div>

				<AlertDialog open={isRollbackDialogOpen} onOpenChange={setIsRollbackDialogOpen}>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle className="flex items-center space-x-2">
								<AlertTriangle className="w-5 h-5 text-destructive" />
								<span>Confirm Rollback</span>
							</AlertDialogTitle>
							<AlertDialogDescription>
								This action will revert the file to the chosen version. Are you sure you want to
								continue?
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
			prevProps.kodu_content === nextProps.kodu_content &&
			prevProps.kodu_diff === nextProps.kodu_diff &&
			prevProps.list_versions_output === nextProps.list_versions_output &&
			prevProps.ts === nextProps.ts &&
			prevProps.path === nextProps.path &&
			prevProps.notAppliedCount === nextProps.notAppliedCount &&
			prevProps.mode === nextProps.mode &&
			prevProps.rollback_version === nextProps.rollback_version
		)
	}
)
