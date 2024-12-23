import React, { useState, useCallback, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Save, Copy, RefreshCw } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const TEMPLATE_PLACEHOLDERS = {
	agentName: {
		description: "The name of the AI assistant being configured",
	},
	osName: {
		description: "The operating system the agent is running on (e.g., Windows, Linux, macOS)",
	},
	defaultShell: {
		description: "The default shell used by the system (e.g., bash, powershell)",
	},
	homeDir: {
		description: "User's home directory path",
	},
	cwd: {
		description: "Current working directory path",
	},
	toolSection: {
		description: "Section containing all available tool definitions",
	},
	capabilitiesSection: {
		description: "Section listing all agent capabilities",
	},
	rulesSection: {
		description: "Section defining agent operational rules",
	},
	tools: {
		description: "List of available tools and their configurations",
	},
	rules: {
		description: "Specific rules and constraints for agent behavior",
	},
	capabilities: {
		description: "Detailed list of agent capabilities and permissions",
	},
}

const PLACEHOLDER_NAMES = Object.keys(TEMPLATE_PLACEHOLDERS)

const TemplateHighlighter = ({ text }) => {
	const parts = text.split(/({{[^}]+}})/g)
	return (
		<div className="pointer-events-none whitespace-pre-wrap font-mono text-sm text-transparent">
			{parts.map((part, index) => {
				if (part.match(/{{[^}]+}}/)) {
					const placeholder = part.slice(2, -2)
					const isValid = placeholder in TEMPLATE_PLACEHOLDERS

					return (
						<span
							key={index}
							className={`${isValid ? "bg-blue-100/70" : "bg-red-100/30"} text-transparent rounded px-0`}>
							{part}
						</span>
					)
				}
				return <span key={index}>{part}</span>
			})}
		</div>
	)
}

const PromptEditor = () => {
	const [value, setValue] = useState("")
	const [suggestions, setSuggestions] = useState([])
	const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0)
	const [cursorInfo, setCursorInfo] = useState({ position: 0, lineHeight: 0, left: 0, top: 0 })
	const [previewValue, setPreviewValue] = useState("")
	const [showCopiedAlert, setShowCopiedAlert] = useState(false)
	const [showSaveDialog, setShowSaveDialog] = useState(false)
	const [templateName, setTemplateName] = useState("")

	const textareaRef = React.useRef(null)
	const suggestionsRef = React.useRef(null)

	const updateSuggestionPosition = useCallback(() => {
		if (!textareaRef.current) return

		const textarea = textareaRef.current
		const text = textarea.value.substring(0, textarea.selectionStart)
		const lines = text.split("\n")
		const currentLine = lines.length
		const currentLineText = lines[lines.length - 1]

		const measurer = document.createElement("div")
		measurer.style.position = "absolute"
		measurer.style.visibility = "hidden"
		measurer.style.whiteSpace = "pre"
		measurer.style.font = window.getComputedStyle(textarea).font
		measurer.textContent = currentLineText
		document.body.appendChild(measurer)

		const lineHeight = parseInt(window.getComputedStyle(textarea).lineHeight)
		const left = measurer.offsetWidth
		const top = (currentLine - 1) * lineHeight

		document.body.removeChild(measurer)

		setCursorInfo({
			position: textarea.selectionStart,
			lineHeight,
			left,
			top: top + textarea.scrollTop,
		})
	}, [])

	const handleInputChange = (e) => {
		const newValue = e.target.value
		setValue(newValue)
		updateSuggestionPosition()

		const cursorPos = e.target.selectionStart
		const textBeforeCursor = newValue.substring(0, cursorPos)
		const match = textBeforeCursor.match(/{{([^}]*)$/)

		if (match) {
			const partial = match[1].toLowerCase()
			const matches = PLACEHOLDER_NAMES.filter((p) => p.toLowerCase().includes(partial))
			setSuggestions(matches)
			setSelectedSuggestionIndex(0)
		} else {
			setSuggestions([])
		}

		let preview = newValue
		PLACEHOLDER_NAMES.forEach((placeholder) => {
			const regex = new RegExp(`{{${placeholder}}}`, "g")
			preview = preview.replace(regex, `[Example ${placeholder} value]`)
		})
		setPreviewValue(preview)
	}

	const clearEditor = () => {
		setValue("")
		setPreviewValue("")
		setSuggestions([])
		if (textareaRef.current) {
			textareaRef.current.focus()
		}
	}

	const insertSuggestion = (suggestion) => {
		const beforeCursor = value.substring(0, cursorInfo.position)
		const afterCursor = value.substring(cursorInfo.position)
		const lastOpenBrace = beforeCursor.lastIndexOf("{{")

		const newValue = beforeCursor.substring(0, lastOpenBrace) + `{{${suggestion}}}` + afterCursor

		setValue(newValue)
		setSuggestions([])

		if (textareaRef.current) {
			const newPosition = lastOpenBrace + suggestion.length + 4
			textareaRef.current.focus()
			textareaRef.current.setSelectionRange(newPosition, newPosition)
		}
	}

	const handleKeyDown = (e) => {
		if (suggestions.length > 0) {
			switch (e.key) {
				case "ArrowDown":
					e.preventDefault()
					setSelectedSuggestionIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev))
					break
				case "ArrowUp":
					e.preventDefault()
					setSelectedSuggestionIndex((prev) => (prev > 0 ? prev - 1 : prev))
					break
				case "Enter":
					e.preventDefault()
					insertSuggestion(suggestions[selectedSuggestionIndex])
					break
				case "Escape":
					setSuggestions([])
					break
			}
		}
		updateSuggestionPosition()
	}

	const handleSave = useCallback(() => {
		if (templateName.trim()) {
			// Here you would implement the actual save logic
			console.log("Saving template:", {
				name: templateName,
				content: value,
			})
			setShowSaveDialog(false)
			setTemplateName("")
		}
	}, [templateName, value])

	const handleCopy = useCallback(() => {
		navigator.clipboard.writeText(value).then(() => {
			setShowCopiedAlert(true)
			setTimeout(() => setShowCopiedAlert(false), 2000)
		})
	}, [value])

	useEffect(() => {
		const handleClickOutside = (event) => {
			if (suggestionsRef.current && !suggestionsRef.current.contains(event.target)) {
				setSuggestions([])
			}
		}

		document.addEventListener("mousedown", handleClickOutside)
		return () => document.removeEventListener("mousedown", handleClickOutside)
	}, [])

	const renderPreview = () => {
		const parts = previewValue.split(/({{[^}]+}})/g)
		return parts.map((part, index) => {
			if (part.match(/{{[^}]+}}/)) {
				const placeholder = part.slice(2, -2)
				const isValid = placeholder in TEMPLATE_PLACEHOLDERS

				return (
					<span
						key={index}
						className={`px-1 rounded ${isValid ? "bg-blue-100 text-blue-800" : "bg-red-100 text-red-800"}`}>
						{isValid ? part : `${part} (Invalid)`}
					</span>
				)
			}
			return <span key={index}>{part}</span>
		})
	}

	return (
		<>
			<Card className="w-full max-w-4xl">
				<CardHeader>
					<CardTitle className="flex items-center justify-between">
						<span>Prompt Template Editor</span>
						<div className="flex gap-2">
							<Button
								variant="outline"
								size="sm"
								onClick={handleCopy}
								className="flex items-center gap-2">
								<Copy className="w-4 h-4" />
								Copy
							</Button>
							<Button
								variant="outline"
								size="sm"
								onClick={clearEditor}
								className="flex items-center gap-2">
								<RefreshCw className="w-4 h-4" />
								Clear
							</Button>
							<Button
								size="sm"
								onClick={() => setShowSaveDialog(true)}
								className="flex items-center gap-2">
								<Save className="w-4 h-4" />
								Save
							</Button>
						</div>
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-4">
						<div className="relative">
							<div className="relative w-full h-64 font-mono text-sm border rounded-md focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
								<div className="absolute inset-0 p-4 pointer-events-none">
									<TemplateHighlighter text={value} />
								</div>
								<textarea
									ref={textareaRef}
									className="absolute inset-0 w-full h-full p-4 text-sm bg-transparent focus:outline-none resize-none"
									value={value}
									onChange={handleInputChange}
									onKeyDown={handleKeyDown}
									placeholder="Enter your prompt template here...&#10;Use {{ to trigger autocompletion"
									spellCheck="false"
								/>
							</div>

							{suggestions.length > 0 && (
								<div
									ref={suggestionsRef}
									className="absolute z-10 w-96 bg-white border rounded-md shadow-lg overflow-hidden"
									style={{
										left: `${cursorInfo.left + 20}px`,
										top: `${cursorInfo.top + cursorInfo.lineHeight}px`,
									}}>
									{suggestions.map((suggestion, index) => (
										<div
											key={suggestion}
											className={`cursor-pointer ${
												index === selectedSuggestionIndex ? "bg-blue-50" : "hover:bg-gray-50"
											}`}
											onClick={() => insertSuggestion(suggestion)}
											onMouseEnter={() => setSelectedSuggestionIndex(index)}>
											<div className="px-4 py-2 flex items-center gap-2">
												<span className="font-medium">{`{{${suggestion}}}`}</span>
											</div>
											<div className="px-4 pb-2 text-sm text-gray-600">
												{TEMPLATE_PLACEHOLDERS[suggestion].description}
											</div>
										</div>
									))}
								</div>
							)}
						</div>

						<div className="space-y-2">
							<h3 className="text-lg font-semibold">Preview</h3>
							<div className="p-4 bg-gray-50 rounded-md min-h-32">
								<div className="whitespace-pre-wrap">{renderPreview()}</div>
							</div>
						</div>
					</div>
				</CardContent>
			</Card>

			<Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Save Template</DialogTitle>
					</DialogHeader>
					<div className="space-y-4 py-4">
						<div className="space-y-2">
							<Label htmlFor="template-name">Template Name</Label>
							<Input
								id="template-name"
								value={templateName}
								onChange={(e) => setTemplateName(e.target.value)}
								placeholder="Enter template name..."
							/>
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setShowSaveDialog(false)}>
							Cancel
						</Button>
						<Button onClick={handleSave} disabled={!templateName.trim()}>
							Save Template
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{showCopiedAlert && (
				<Alert className="fixed bottom-4 right-4 w-auto">
					<AlertDescription>Template copied to clipboard!</AlertDescription>
				</Alert>
			)}
		</>
	)
}

export default PromptEditor
