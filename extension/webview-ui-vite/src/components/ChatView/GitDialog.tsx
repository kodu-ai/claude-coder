import React, { useCallback, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { formatDistanceToNow } from "date-fns"
import { Button } from "@/components/ui/button"
import { useEvent } from "react-use"
import { ExtensionMessage, GitBranchItem, GitLogItem } from "../../../../src/shared/ExtensionMessage"
import { vscode } from "@/utils/vscode"
import { FlagTriangleRight, Goal, Info } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip"
import { ScrollArea } from "../ui/scroll-area"
import { Separator } from "../ui/separator"
import { Input } from "@/components/ui/input"

const GitDialog: React.FC = () => {
	const [gitLog, setGitLog] = useState<GitLogItem[]>([])
	const [open, setOpen] = useState(false)
	const [gitBranches, setGitBranches] = useState<GitBranchItem[]>([])
	const [selectedCommitHash, setSelectedCommitHash] = useState<string | null>(null)
	const [newBranchName, setNewBranchName] = useState("")

	const handleMessage = useCallback((e: MessageEvent) => {
		const message: ExtensionMessage = e.data
		if (message.type === "gitLog") {
			console.log({ message })
			setGitLog(message.history)
		} else if (message.type === "gitBranches") {
			console.log({ message })
			setGitBranches(message.branches)
		}
	}, [])

	useEvent("message", handleMessage)

	const onOpen = () => {
		vscode.postMessage({ type: "gitLog" })
		vscode.postMessage({ type: "gitBranches" })
		setSelectedCommitHash(null)
		setOpen(true)
	}

	const checkoutTo = (identifier: string, newBranchName?: string) => {
		vscode.postMessage({ type: "gitCheckoutTo", identifier, newBranchName })
		setOpen(false)
		setSelectedCommitHash(null)
		setNewBranchName("")
	}

	const handleCreateBranch = () => {
		if (selectedCommitHash && newBranchName) {
			checkoutTo(selectedCommitHash, newBranchName)
		}
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger>
				<Tooltip>
					<TooltipTrigger>
						<Button variant="outline" size="icon" onClick={onOpen}>
							<FlagTriangleRight className="h-3 w-3" />
						</Button>
					</TooltipTrigger>
					<TooltipContent side="right">
						<p>Project Timeline</p>
					</TooltipContent>
				</Tooltip>
			</DialogTrigger>

			<DialogContent className="sm:max-w-[350px] flex flex-col gap-0">
				<DialogHeader>
					<DialogTitle className="text-base">Timeline</DialogTitle>
				</DialogHeader>

				<p className="text-sm font-semibold">Branches</p>
				<div className="relative h-[100px] overflow-hidden">
					<ScrollArea className="h-[100px] pr-2 pb-2">
						<div className="mb-2">
							{gitBranches.map((branch) => (
								<div
									key={branch.name}
									onClick={() => checkoutTo(branch.name)}
									className="flex items-center space-x-2 py-1 cursor-pointer rounded-sm bg-accent-light">
									<div
										className={`w-4 h-4 rounded-full flex items-center justify-center ${
											branch.isCheckedOut ? "bg-primary" : "bg-secondary"
										}`}>
										<Goal className="h-3 w-3 text-secondary-foreground" />
									</div>

									<div className="flex items-center justify-between flex-grow">
										<p className="text-[12px] truncate">{branch.name}</p>
										<p className="text-[8px] text-muted-foreground/40">
											{branch.lastCommitRelativeTime}
										</p>
									</div>
								</div>
							))}
						</div>
						<div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-background to-transparent pointer-events-none"></div>
					</ScrollArea>
				</div>
				<Separator />

				<div className="flex items-center space-x-1">
					<p className="text-sm font-semibold">Checkpoints</p>
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<Info className="h-3 w-3 text-muted-foreground" />
							</TooltipTrigger>
							<TooltipContent avoidCollisions side="right">
								<p>You can create a new branch from any checkpoint.</p>
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				</div>
				<div className="relative h-[100px] overflow-hidden">
					<ScrollArea className="h-[100px] pr-2">
						<div className="mt-2">
							{gitLog.map((checkpoint) => (
								<div
									key={checkpoint.hash}
									onClick={() => setSelectedCommitHash(checkpoint.hash)}
									className={`flex items-center space-x-2 py-1 px-2 cursor-pointer rounded-sm bg-accent-light hover:bg-primary/10 ${
										selectedCommitHash === checkpoint.hash ? "bg-accent" : ""
									}`}>
									<div className="w-3 h-3 rounded-full flex items-center justify-center bg-secondary">
										<FlagTriangleRight className="h-2 w-2 text-primary-foreground" />
									</div>
									<div className="w-full flex flex-col">
										<div className="text-[12px] max-w-[320px] truncate">{checkpoint.message}</div>
										<p className="text-[8px] text-muted-foreground/40">
											{formatDistanceToNow(checkpoint.datetime, { addSuffix: true })}
										</p>
									</div>
								</div>
							))}
						</div>
					</ScrollArea>
					{/* <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-background to-transparent pointer-events-none"></div> */}
				</div>
				{!!selectedCommitHash ? (
					<div className="mt-2 flex items-center space-x-2">
						<Input
							type="text"
							placeholder="New branch name"
							value={newBranchName}
							onChange={(e) => setNewBranchName(e.target.value)}
							className="flex-grow h-7"
						/>
						<Button size="sm" onClick={handleCreateBranch} disabled={!newBranchName}>
							Create Branch
						</Button>
					</div>
				) : (
					<div className="mt-2 text-[10px] text-muted-foreground border border-primary/20 rounded-lg p-2">
						Select a checkpoint to create a new branch.
					</div>
				)}
			</DialogContent>
		</Dialog>
	)
}

export default GitDialog
