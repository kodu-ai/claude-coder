"use client"

import React, { useState, useCallback, useEffect } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { LayoutList, Edit, Save, X } from "lucide-react"
import { vscode } from "@/utils/vscode"
import { ExtensionMessage } from "../../../../src/shared/ExtensionMessage"
import { useEvent } from "react-use"

export default function TaskHistoryModal() {
	const [history, setHistory] = useState("")
	const [isEditing, setIsEditing] = useState(false)
	const [isOpen, setIsOpen] = useState(false)

	const handleMessage = useCallback((e: MessageEvent) => {
		const message: ExtensionMessage = e.data
		if (message.type === "taskHistory" && message.history !== undefined) {
			setHistory(message.history)
		}
	}, [])
	useEvent("message", handleMessage)

	const onOpen = () => {
		vscode.postMessage({ type: "getTaskHistory" })
		setIsOpen(true)
	}

	const save = () => {
		vscode.postMessage({ type: "updateTaskHistory", history })
		setIsEditing(false)
	}

	const handleHistoryChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		setHistory(e.target.value)
	}

	const startEditing = () => {
		setIsEditing(true)
	}

	const cancelEditing = () => {
		setIsEditing(false)
		vscode.postMessage({ type: "getTaskHistory" })
	}

	return (
		<Dialog open={isOpen} onOpenChange={setIsOpen}>
			<DialogTrigger asChild>
				<Button variant="outline" size="icon" onClick={onOpen}>
					<LayoutList className="h-4 w-4" />
					<span className="sr-only">Open task history</span>
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle>Task History</DialogTitle>
				</DialogHeader>
				<div className="mt-4">
					{isEditing ? (
						<>
							<Textarea
								value={history}
								onChange={handleHistoryChange}
								className="w-full h-64 p-2 text-sm border rounded mb-4"
								placeholder="Enter your tasks here... Use GitHub-flavored markdown for formatting."
							/>
							<div className="flex justify-end space-x-2">
								<Button onClick={cancelEditing} variant="outline" size="sm">
									<X className="h-4 w-4 mr-1" /> Cancel
								</Button>
								<Button onClick={save} size="sm">
									<Save className="h-4 w-4 mr-1" /> Save
								</Button>
							</div>
						</>
					) : (
						<>
							<div className="border rounded p-4 prose prose-sm max-w-none h-64 overflow-y-auto mb-4">
								<ReactMarkdown remarkPlugins={[remarkGfm]}>{history}</ReactMarkdown>
							</div>
							<div className="flex justify-end">
								<Button onClick={startEditing} size="sm">
									<Edit className="h-4 w-4 mr-1" /> Edit
								</Button>
							</div>
						</>
					)}
				</div>
			</DialogContent>
		</Dialog>
	)
}
