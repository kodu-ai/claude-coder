import React, { useCallback, useEffect, useState } from "react"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useEvent } from "react-use"
import { ExtensionMessage, GitLogItem } from "../../../../src/shared/ExtensionMessage"
import { vscode } from "@/utils/vscode"
import { FlagTriangleRight } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip"

const GitDialog: React.FC = () => {
	const [gitLog, setGitLog] = useState<GitLogItem[]>([])
	const [open, setOpen] = useState(false)

	useEffect(() => {
		vscode.postMessage({ type: "gitLog" })
	}, [])

	const handleMessage = useCallback((e: MessageEvent) => {
		const message: ExtensionMessage = e.data
		if (message.type === "gitLog") {
			setGitLog(message.history)
		}
	}, [])

	useEvent("message", handleMessage)

	const onSubmit = () => {
		console.log({ gitLog })
		// vscode.postMessage({ type: "gitCheckout", hash: gitLog[0].hash })
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger>
				<Tooltip>
					<TooltipTrigger>
						<Button variant="ghost" size="icon">
							<FlagTriangleRight size={16} />
						</Button>
					</TooltipTrigger>
					<TooltipContent className="opacity-100" side="right">
						<p>Checkpoints</p>
					</TooltipContent>
				</Tooltip>
			</DialogTrigger>

			<DialogContent className="max-w-[600px] w-[90vw] bg-background text-foreground">
				<DialogHeader>
					<DialogTitle>Checkpoints</DialogTitle>
					<DialogDescription>Choose a checkout you want to jump to.</DialogDescription>
				</DialogHeader>
				<div className="py-4">
					{gitLog.map((item) => (
						<div key={item.hash}>{item.hash}</div>
					))}
				</div>
				<Button onClick={onSubmit}>Add Selected Items</Button>
			</DialogContent>
		</Dialog>
	)
}

export default GitDialog
