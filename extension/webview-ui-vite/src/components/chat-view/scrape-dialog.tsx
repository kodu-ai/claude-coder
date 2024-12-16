import React from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

type ScrapeDialogProps = {
	open: boolean
	onClose: () => void
	scrapeUrl: string
	setScrapeUrl: (url: string) => void
	scrapeDescription: string
	setScrapeDescription: (description: string) => void
	onSubmit: () => void
}

const ScrapeDialog: React.FC<ScrapeDialogProps> = ({
	open,
	onClose,
	scrapeUrl,
	setScrapeUrl,
	scrapeDescription,
	setScrapeDescription,
	onSubmit,
}) => {
	return (
		<Dialog open={open} onOpenChange={onClose}>
			<DialogContent className="max-w-[400px] w-[90vw] bg-background text-foreground">
				<DialogHeader>
					<DialogTitle>Web Scraping</DialogTitle>
					<DialogDescription>Enter a URL and description to create a web scraping task.</DialogDescription>
				</DialogHeader>
				<div className="grid gap-4 py-4">
					<Textarea
						placeholder="Enter URL here (e.g., https://example.com)"
						value={scrapeUrl}
						onChange={(e) => setScrapeUrl(e.target.value)}
						className="bg-secondary text-secondary-foreground"
					/>
					<Textarea
						placeholder="Enter description (e.g., product prices)"
						value={scrapeDescription}
						onChange={(e) => setScrapeDescription(e.target.value)}
						className="bg-secondary text-secondary-foreground"
					/>
					<DialogDescription>Example output: search https://example.com for product prices</DialogDescription>
					<Button onClick={onSubmit}>Create Scraping Task</Button>
				</div>
			</DialogContent>
		</Dialog>
	)
}

export default ScrapeDialog
