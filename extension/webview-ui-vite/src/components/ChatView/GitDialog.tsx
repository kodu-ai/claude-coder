import React, { useCallback, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useEvent } from "react-use"
import { ExtensionMessage, GitBranchItem } from "../../../../src/shared/ExtensionMessage"
import { vscode } from "@/utils/vscode"
import { FlagTriangleRight, Goal, Info } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip"
import { ScrollArea } from "../ui/scroll-area"
import { Separator } from "../ui/separator"
import { Input } from "@/components/ui/input"

const GitDialog: React.FC = () => {
	const [open, setOpen] = useState(false)
	const [gitBranches, setGitBranches] = useState<GitBranchItem[]>([])
	const [checkoutToBranchName, setCheckoutToBranchName] = useState("")

	const handleMessage = useCallback((e: MessageEvent) => {
		const message: ExtensionMessage = e.data
		if (message.type === "gitBranches") {
			console.log({ message })
			setGitBranches(message.branches)
		}
	}, [])

	useEvent("message", handleMessage)

	const onOpen = () => {
		vscode.postMessage({ type: "gitBranches" })
		setOpen(true)
		setCheckoutToBranchName("")
	}

	const checkout = () => {
		vscode.postMessage({ type: "gitCheckoutTo", branchName: checkoutToBranchName })
		setOpen(false)
		setCheckoutToBranchName("")
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

			<DialogContent className="sm:max-w-[350px] flex flex-col gap-0 px-2">
				<DialogHeader>
					<DialogTitle className="text-base">Timeline</DialogTitle>
				</DialogHeader>

				<p className="text-sm font-semibold px-2">Milestones</p>
				{gitBranches.length ? (
					<div className="relative h-[200px] overflow-hidden">
						<ScrollArea className="h-[200px] pr-2 pb-2">
							<div className="mb-2">
								{gitBranches.map((branch) => (
									<div
										key={branch.name}
										onClick={() => setCheckoutToBranchName(branch.name)}
										className="flex items-center space-x-2 py-1 cursor-pointer rounded-sm bg-accent-light hover:bg-muted px-2">
										<div
											className={`w-4 h-4 rounded-full flex items-center justify-center ${
												branch.isCheckedOut ? "bg-primary" : "bg-secondary"
											}`}>
											<Goal className="h-3 w-3 text-secondary-foreground" />
										</div>

										<div className="w-full flex flex-col">
											<div className="flex items-center justify-between flex-grow">
												<p className="text-[12px] truncate">{branch.name}</p>
												<p className="text-[8px] text-muted-foreground/40">
													{branch.lastCommitRelativeTime}
												</p>
											</div>
											<p className="text-[10px] text-muted-foreground">
												{branch.lastCommitMessage}
											</p>
										</div>
									</div>
								))}
							</div>
							<div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-background to-transparent pointer-events-none"></div>
						</ScrollArea>
					</div>
				) : (
					<div className="text-muted-foreground text-[10px] mb-10">No branches found</div>
				)}

				{gitBranches.length > 0 && (
					<div className="flex gap-2">
						<Input
							placeholder="Select a version"
							disabled={true}
							value={checkoutToBranchName}
							onChange={(e) => setCheckoutToBranchName(e.target.value)}
							className="flex-1 h-7"
						/>
						<Button onClick={checkout} disabled={!checkoutToBranchName} className="h-7">
							Checkout
						</Button>
					</div>
				)}
			</DialogContent>
		</Dialog>
	)
}

export default GitDialog
