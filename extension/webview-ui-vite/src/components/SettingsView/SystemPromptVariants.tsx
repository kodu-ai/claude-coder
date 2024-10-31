import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Plus, Save, Trash2 } from "lucide-react"
import { useSettingsState } from "../../hooks/useSettingsState"
import { SystemPromptVariant } from "../../../../src/shared/SystemPromptVariant"

const SystemPromptVariants: React.FC = () => {
	const { systemPromptVariants, handleSaveSystemPrompt, handleDeleteSystemPrompt } = useSettingsState()
	const [newVariantName, setNewVariantName] = useState("")
	const [newVariantContent, setNewVariantContent] = useState("")
	const [editMode, setEditMode] = useState<string | null>(null)

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

	return (
		<div className="space-y-4">
			<Label className="text-sm font-medium">System Prompt Variants</Label>
			
			{/* Existing Variants */}
			<div className="space-y-4">
				{systemPromptVariants?.map((variant) => (
					<div key={variant.id} className="space-y-2 p-4 border rounded-lg">
						<div className="flex items-center justify-between">
							{editMode === variant.id ? (
								<Input
									value={variant.name}
									onChange={(e) => {
										handleSaveSystemPrompt({
											...variant,
											name: e.target.value,
										})
									}}
									className="text-sm font-medium"
								/>
							) : (
								<Label className="text-sm font-medium">{variant.name}</Label>
							)}
							<div className="flex gap-2">
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
						<Textarea
							value={variant.content}
							onChange={(e) => {
								handleSaveSystemPrompt({
									...variant,
									content: e.target.value,
								})
							}}
							className="min-h-[100px] text-xs"
							disabled={editMode !== variant.id}
						/>
					</div>
				))}
			</div>

			{/* Add New Variant */}
			<div className="space-y-2 p-4 border rounded-lg border-dashed">
				<Label className="text-sm font-medium">Add New Variant</Label>
				<Input
					placeholder="Variant Name"
					value={newVariantName}
					onChange={(e) => setNewVariantName(e.target.value)}
					className="mb-2"
				/>
				<Textarea
					placeholder="System Prompt Content"
					value={newVariantContent}
					onChange={(e) => setNewVariantContent(e.target.value)}
					className="min-h-[100px] text-xs"
				/>
				<Button
					onClick={handleAddNewVariant}
					disabled={!newVariantName || !newVariantContent}
					className="w-full mt-2">
					<Plus className="h-4 w-4 mr-2" />
					Add Variant
				</Button>
			</div>
		</div>
	)
}

export default SystemPromptVariants