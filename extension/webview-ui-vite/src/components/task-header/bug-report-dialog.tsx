import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog'
import { vscode } from '@/utils/vscode'
import { VSCodeButton } from '@vscode/webview-ui-toolkit/react'
import { useState } from 'react'

export default function BugReportDialog() {
	const [open, setOpen] = useState(false)

	const handleJoinDiscord = () => {
		vscode.postMessage({ type: 'openExternalLink', url: 'https://discord.gg/Fn97SD34qk' })
		setOpen(false)
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<VSCodeButton appearance="icon">Report Bug</VSCodeButton>
			</DialogTrigger>
			<DialogContent className="sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle>Need Support?</DialogTitle>
					<DialogDescription>
						We provide support and address bug reports through our Discord community.
					</DialogDescription>
				</DialogHeader>
				<div className="py-4">
					<p>Join our Discord server to:</p>
					<ul className="list-disc pl-5 mt-2">
						<li>Get help from our community</li>
						<li>Report bugs directly to our team</li>
						<li>Stay updated on the latest features</li>
					</ul>
				</div>
				<DialogFooter>
					<Button onClick={handleJoinDiscord} className="w-full">
						Join Discord for Support
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
