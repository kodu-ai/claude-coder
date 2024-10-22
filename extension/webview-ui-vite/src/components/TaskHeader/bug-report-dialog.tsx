'use client'

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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { vscode } from '@/utils/vscode'
import { VSCodeButton } from '@vscode/webview-ui-toolkit/react'
import { useState } from 'react'

export default function BugReportDialog() {
	const [description, setDescription] = useState('')
	const [steps, setSteps] = useState('')
	const [open, setOpen] = useState(false)

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault()
		vscode.postMessage({ type: 'exportBug', description, reproduction: steps })
		// Here you would handle the submission of the bug report
		console.log('Bug report submitted:', { description, steps })
		// Reset form and close dialog
		setDescription('')
		setSteps('')
		setOpen(false)
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<VSCodeButton appearance="icon">Report Bug</VSCodeButton>
			</DialogTrigger>
			<DialogContent className="sm:max-w-[90vw] max-w-[95vw] w-full">
				<DialogHeader>
					<DialogTitle>Report a Bug</DialogTitle>
					<DialogDescription>
						This will only export non-sensitive information (state of API, state of the messages history
						without content) and won't expose any content, just API states.
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={handleSubmit} className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="description">Description</Label>
						<Textarea
							id="description"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							placeholder="Describe the bug..."
							className="h-20"
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="steps">Reproduction Steps</Label>
						<Textarea
							id="steps"
							value={steps}
							onChange={(e) => setSteps(e.target.value)}
							placeholder="Steps to reproduce the bug..."
							className="h-20"
						/>
					</div>
					<DialogFooter>
						<Button type="submit" className="w-full">
							Submit Bug Report
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	)
}
