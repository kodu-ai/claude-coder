import React, { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Plus, Save, Trash2, Eye, EyeOff, Pencil, Check, Power } from "lucide-react"
import { useSettingsState } from "../../hooks/useSettingsState"
import { SystemPromptVariant } from "../../../../src/shared/SystemPromptVariant"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

const systemVariables = [
	{ 
		name: "cwd", 
		label: "Current Directory",
		description: "The current working directory where commands will be executed"
	},
	{ 
		name: "tools", 
		label: "Available Tools",
		description: "List of all available tools that can be used to accomplish tasks"
	},
	{ 
		name: "technicalLevel", 
		label: "Technical Level",
		description: "The user's technical expertise level (no-technical, technical, or developer)"
	},
	{ 
		name: "sysInfo", 
		label: "System Info",
		description: "Information about the user's operating system and environment"
	}
]

const HighlightedTextarea: React.FC<{
	id: string
	value: string
	onChange: (value: string) => void
	disabled?: boolean
	className?: string
}> = ({ id, value, onChange, disabled, className }) => {
	const textareaRef = useRef<HTMLTextAreaElement>(null)
	const [cursorPosition, setCursorPosition] = useState<number>(0)

	useEffect(() => {
		if (textareaRef.current) {
			textareaRef.current.setSelectionRange(cursorPosition, cursorPosition)
		}
	}, [value, cursorPosition])

	const getHighlightedContent = (text: string) => {
		let highlightedContent = text
		systemVariables.forEach(({ name }) => {
			highlightedContent = highlightedContent.replace(
				new RegExp(`(${name})`, 'gi'),
				`<span style="color: rgb(251 146 60);">$1</span>`
			)
		})
		return highlightedContent
	}

	return (
		<div className="relative min-h-[100px] font-mono text-xs">
			<div
				className="absolute inset-0 whitespace-pre-wrap p-3 pointer-events-none"
				dangerouslySetInnerHTML={{ 
					__html: getHighlightedContent(value)
				}}
			/>
			<textarea
				ref={textareaRef}
				id={id}
				value={value}
				onChange={(e) => {
					setCursorPosition(e.target.selectionStart)
					onChange(e.target.value)
				}}
				disabled={disabled}
				className={`absolute inset-0 bg-transparent text-transparent caret-foreground selection:bg-accent selection:text-accent-foreground resize-none p-3 ${className}`}
				style={{ caretColor: 'var(--foreground)' }}
			/>
		</div>
	)
}

const SystemPromptVariants: React.FC = () => {
	const { systemPromptVariants, handleSaveSystemPrompt, handleDeleteSystemPrompt, handleSetActiveVariant, activeVariantId } = useSettingsState()
	const [newVariantName, setNewVariantName] = useState("")
	const [newVariantContent, setNewVariantContent] = useState("")
	const [editMode, setEditMode] = useState<string | null>(null)
	const [showPreview, setShowPreview] = useState<string | null>(null)
	const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)

	const handleAddNewVariant = () => {
		if (!newVariantName || !newVariantContent) return

		handleSaveSystemPrompt({
			id: Date.now().toString(),
			name: newVariantName,
			content: newVariantContent,
		})

		setNewVariantName("")
		setNewVariantContent("")
		setIsAddDialogOpen(false)
	}

	const insertVariable = (textAreaId: string, variable: string) => {
		const textarea = document.getElementById(textAreaId) as HTMLTextAreaElement
		if (textarea) {
			const start = textarea.selectionStart
			const end = textarea.selectionEnd
			const text = textarea.value
			const before = text.substring(0, start)
			const after = text.substring(end)
			
			const newText = `${before}${variable}${after}`
			if (editMode) {
				const variant = systemPromptVariants?.find(v => v.id === editMode)
				if (variant) {
					handleSaveSystemPrompt({
						...variant,
						content: newText
					})
				}
			} else {
				setNewVariantContent(newText)
			}
		}
	}

	const highlightSystemVariables = (content: string) => {
		let highlightedContent = content
		systemVariables.forEach(({ name }) => {
			highlightedContent = highlightedContent.replace(
				new RegExp(`(${name})`, 'gi'),
				`<span class="text-orange-400 font-semibold">$1</span>`
			)
		})
		return <div dangerouslySetInnerHTML={{ __html: highlightedContent }} className="whitespace-pre-wrap" />
	}

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between mb-4">
				<div className="flex flex-col gap-2">
					<Label className="text-sm font-medium">System Prompt Variables</Label>
					<div className="flex flex-wrap gap-2">
						<TooltipProvider>
							{systemVariables.map(({ name, label, description }) => (
								<Tooltip key={name}>
									<TooltipTrigger asChild>
										<Badge 
											variant="outline" 
											className="text-xs cursor-pointer hover:bg-accent"
											onClick={() => {
												if (editMode) {
													insertVariable(`textarea-${editMode}`, name)
												} else {
													insertVariable('new-variant-textarea', name)
												}
											}}
										>
											{label}: <span className="text-orange-400 ml-1">{name}</span>
										</Badge>
									</TooltipTrigger>
									<TooltipContent>
										<p>{description}</p>
									</TooltipContent>
								</Tooltip>
							))}
						</TooltipProvider>
					</div>
				</div>
				<Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
					<DialogTrigger asChild>
						<Button variant="outline" size="sm">
							<Plus className="h-4 w-4 mr-2" />
							Add Variant
						</Button>
					</DialogTrigger>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Add New System Prompt Variant</DialogTitle>
						</DialogHeader>
						<div className="space-y-4">
							<Input
								placeholder="Variant Name"
								value={newVariantName}
								onChange={(e) => setNewVariantName(e.target.value)}
							/>
							<div className="relative border rounded-md">
								<HighlightedTextarea
									id="new-variant-textarea"
									value={newVariantContent}
									onChange={setNewVariantContent}
									className="min-h-[200px] rounded-md"
								/>
							</div>
							<Button
								onClick={handleAddNewVariant}
								disabled={!newVariantName || !newVariantContent}
								className="w-full">
								Add Variant
							</Button>
						</div>
					</DialogContent>
				</Dialog>
			</div>
			
			<Accordion type="single" collapsible className="space-y-2">
				{systemPromptVariants?.map((variant) => (
					<AccordionItem key={variant.id} value={variant.id} className="border rounded-lg">
						<AccordionTrigger className="px-4 py-2 hover:no-underline">
							<div className="flex items-center justify-between w-full">
								<div className="flex items-center gap-2">
									{editMode === variant.id ? (
										<Input
											value={variant.name}
											onChange={(e) => {
												handleSaveSystemPrompt({
													...variant,
													name: e.target.value,
												})
											}}
											className="text-sm font-medium w-48"
											onClick={(e) => e.stopPropagation()}
										/>
									) : (
										<div className="flex items-center gap-2">
											<span className="text-sm font-medium">{variant.name}</span>
											{activeVariantId === variant.id && (
												<Badge variant="secondary" className="text-xs">Active</Badge>
											)}
										</div>
									)}
								</div>
								<div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
									<Button
										variant={activeVariantId === variant.id ? "secondary" : "ghost"}
										size="icon"
										onClick={() => handleSetActiveVariant(variant.id)}
										className="relative">
										<Power className="h-4 w-4" />
										<TooltipProvider>
											<Tooltip>
												<TooltipTrigger asChild>
													<span className="sr-only">
														{activeVariantId === variant.id ? "Active Variant" : "Set as Active"}
													</span>
												</TooltipTrigger>
												<TooltipContent>
													<p>{activeVariantId === variant.id ? "Active Variant" : "Set as Active"}</p>
												</TooltipContent>
											</Tooltip>
										</TooltipProvider>
									</Button>
									<Button
										variant="ghost"
										size="icon"
										onClick={() => setShowPreview(showPreview === variant.id ? null : variant.id)}>
										{showPreview === variant.id ? (
											<EyeOff className="h-4 w-4" />
										) : (
											<Eye className="h-4 w-4" />
										)}
									</Button>
									<Button
										variant={editMode === variant.id ? "secondary" : "ghost"}
										size="icon"
										onClick={() => {
											if (editMode === variant.id) {
												setEditMode(null)
											} else {
												setEditMode(variant.id)
											}
										}}>
										{editMode === variant.id ? (
											<Check className="h-4 w-4" />
										) : (
											<Pencil className="h-4 w-4" />
										)}
									</Button>
									<Button
										variant="ghost"
										size="icon"
										onClick={() => handleDeleteSystemPrompt(variant.id)}>
										<Trash2 className="h-4 w-4" />
									</Button>
								</div>
							</div>
						</AccordionTrigger>
						<AccordionContent className="px-4 pb-2">
							{showPreview === variant.id ? (
								<div className="mt-2 text-xs font-mono bg-muted p-4 rounded-md">
									{highlightSystemVariables(variant.content)}
								</div>
							) : (
								<div className="relative border rounded-md mt-2">
									<HighlightedTextarea
										id={`textarea-${variant.id}`}
										value={variant.content}
										onChange={(value) => {
											handleSaveSystemPrompt({
												...variant,
												content: value,
											})
										}}
										disabled={editMode !== variant.id}
									/>
								</div>
							)}
						</AccordionContent>
					</AccordionItem>
				))}
			</Accordion>
		</div>
	)
}

export default SystemPromptVariants