'use client'

import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import { AlertCircle, CheckCircle, NotebookPen } from 'lucide-react'
import { useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
interface Message {
	say: 'error' | 'success'
	title: string
	content: string
}

interface MemoryUpdateProps {
	message: Message
}

export default function MemoryUpdate({ message }: MemoryUpdateProps) {
	const [isDialogOpen, setIsDialogOpen] = useState(false)

	const getIcon = (say: Message['say']) => {
		switch (say) {
			case 'error':
				return <AlertCircle className="h-4 w-4" />
			case 'success':
				return <CheckCircle className="h-4 w-4" />
			default:
				return <NotebookPen className="h-4 w-4" />
		}
	}

	return (
		<>
			<motion.div
				whileHover={{ scale: 1.05 }}
				whileTap={{ scale: 0.95 }}
				className="cursor-pointer"
				onClick={() => setIsDialogOpen(true)}
			>
				<div className="flex items-center gap-2  pr-2 bg-muted text-foreground rounded-md p-2 shadow-sm">
					<div className="rounded-full">{getIcon(message.say)}</div>
					<span className="text-sm font-medium truncate">{message.title}</span>
				</div>
			</motion.div>

			<Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
				<DialogContent className="sm:max-w-[425px]">
					<DialogHeader>
						<DialogTitle className="flex items-center space-x-2">
							{getIcon(message.say)}
							<span>{message.title}</span>
						</DialogTitle>
					</DialogHeader>
					<Markdown className={cn('text-foreground', 'p-4')}>{message.content}</Markdown>
				</DialogContent>
			</Dialog>
		</>
	)
}
