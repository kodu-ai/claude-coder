import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Plus, Save, Trash2, Eye, EyeOff } from "lucide-react"
import { useSettingsState } from "../../hooks/useSettingsState"
import { SystemPromptVariant } from "../../../../src/shared/SystemPromptVariant"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

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

const SystemPromptVariants: React.FC = () => {
	const { systemPromptVariants, handleSaveSystemPrompt, handleDeleteSystemPrompt } = useSettingsState()
	const [newVariantName, setNewVariantName] = useState("")
	const [newVariantContent, setNewVariantContent] = useState("")
	const [editMode, setEditMode] = useState<string | null>(null)
	const [showPreview, setShowPreview] = useState<string | null>(null)

	const handleAddNewVariant = () => {
		if (!newVariantName || !newVariantContent) return

		handleSaveSystemPrompt({
			id: Date.now().toString(),
			name: newVariantName,
			content: newVariantContent,
		})

		setNewVariantName("")
		setNewVariantContent("")
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
			
			textarea.focus()
			const newCursorPos = start + variable.length
			textarea.setSelectionRange(newCursorPos, newCursorPos)
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
			<div className="flex flex-col gap-2 mb-4">
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
			
			{/* Existing Variants */}
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
										<span className="text-sm font-medium">{variant.name}</span>
									)}
								</div>
								<div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
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
										variant="ghost"
										size="icon"
										onClick={() => {
											if (editMode === variant.id) {
												setEditMode(null)
											} else {
												setEditMode(variant.id)
											}
										}}>
										<Save className="h-4 w-4" />
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
								<Textarea
									id={`textarea-${variant.id}`}
									value={variant.content}
									onChange={(e) => {
										handleSaveSystemPrompt({
											...variant,
											content: e.target.value,
										})
									}}
									className="min-h-[100px] text-xs font-mono"
									disabled={editMode !== variant.id}
								/>
							)}
						</AccordionContent>
					</AccordionItem>
				))}
			</Accordion>

			{/* Add New Variant */}
			<Card className="p-4 border-dashed">
				<Label className="text-sm font-medium">Add New Variant</Label>
				<div className="mt-2 space-y-2">
					<Input
						placeholder="Variant Name"
						value={newVariantName}
						onChange={(e) => setNewVariantName(e.target.value)}
					/>
					<Textarea
						id="new-variant-textarea"
						placeholder="System Prompt Content"
						value={newVariantContent}
						onChange={(e) => setNewVariantContent(e.target.value)}
						className="min-h-[100px] text-xs font-mono"
					/>
					<Button
						onClick={handleAddNewVariant}
						disabled={!newVariantName || !newVariantContent}
						className="w-full">
						<Plus className="h-4 w-4 mr-2" />
						Add Variant
					</Button>
				</div>
			</Card>
		</div>
	)
}

export default SystemPromptVariants