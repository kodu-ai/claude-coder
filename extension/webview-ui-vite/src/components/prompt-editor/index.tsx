import React, { useState, useCallback, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Save, Copy, RefreshCw, FolderOpen, X, Fullscreen, FileEdit } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PromptActions } from "./prompt-actions"
import { useEvent } from "react-use"
import * as monaco from "monaco-editor"
import { ScrollArea, ScrollBar } from "../ui/scroll-area"
import { cn } from "@/lib/utils"
import ToolCards from "./tools"
import { useAtom } from "jotai"
import { currentPromptContentAtom, isCurrentPreviewAtom } from "./utils"
import { editorVariable, TEMPLATE_PLACEHOLDERS, TemplateInfo } from "../../../../src/shared/agent/prompt"

// 1) REGISTER YOUR CUSTOM LANGUAGE (without defining a theme).
//    This still enables syntax highlighting for your placeholders.
monaco.languages.register({ id: "promptTemplate" })

monaco.languages.setMonarchTokensProvider("promptTemplate", {
	tokenizer: {
		root: [
			[
				/{{([^}]+)}}/,
				{
					cases: {
						"^#vision\\}}": "vision.start",
						"^/vision\\}}": "vision.end",
						[editorVariable]: "variable",
						"@default": "invalid",
					},
				},
			],
		],
	},
})
interface PromptEditorProps {}

const promptActions = PromptActions.getInstance()

function useVSCodeTheme() {
	const [theme, setTheme] = useState({
		kind: document.body.getAttribute("data-vscode-theme-kind"),
		name: document.body.getAttribute("data-vscode-theme-name"),
	})

	useEffect(() => {
		// Create observer for theme changes
		const observer = new MutationObserver((mutations) => {
			mutations.forEach((mutation) => {
				if (mutation.type === "attributes") {
					setTheme({
						kind: document.body.getAttribute("data-vscode-theme-kind"),
						name: document.body.getAttribute("data-vscode-theme-name"),
					})
				}
			})
		})

		// Start observing the body element
		observer.observe(document.body, {
			attributes: true,
			attributeFilter: ["data-vscode-theme-kind", "data-vscode-theme-name"],
		})

		// You can also access CSS variables directly:
		const style = getComputedStyle(document.documentElement)
		const foreground = style.getPropertyValue("--vscode-editor-foreground")
		const background = style.getPropertyValue("--vscode-editor-background")

		return () => observer.disconnect()
	}, [])

	// Optional: listen for CSS variable changes
	useEffect(() => {
		const styleObserver = new MutationObserver(() => {
			// Handle CSS variable changes
			const style = getComputedStyle(document.documentElement)
			// Access updated CSS variables...
		})

		styleObserver.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["style"],
		})

		return () => styleObserver.disconnect()
	}, [])

	return theme
}
export const PromptEditor: React.FC<PromptEditorProps> = () => {
	const [value, setValue] = useAtom(currentPromptContentAtom)
	const [previewValue, setPreviewValue] = useState<string>("")
	const [showCopiedAlert, setShowCopiedAlert] = useState<boolean>(false)
	const [showSaveDialog, setShowSaveDialog] = useState<boolean>(false)
	const [showLoadDialog, setShowLoadDialog] = useState<boolean>(false)
	const [templateName, setTemplateName] = useState<string>("")
	const [templates, setTemplates] = useState<TemplateInfo[]>([])
	const [activeTemplate, setActiveTemplate] = useState<string | null>(null)
	const [loadedTemplateName, setLoadedTemplateName] = useState<string | null>(null)
	const monacoContainerRef = useRef<HTMLDivElement | null>(null)
	const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
	const [originalTemplateName, setOriginalTemplateName] = useState<string | null>(null)
	const [originalTemplateContent, setOriginalTemplateContent] = useState<string>("")
	const [preview, setPreview] = useAtom(isCurrentPreviewAtom)

	const theme = useVSCodeTheme()

	useEffect(() => {
		if (!editorRef.current) return
		// editorRef.current.updateOptions({ theme: theme.name?.includes("light") ? "vs" : "vs-dark" })
		editorRef.current.updateOptions({
			theme: theme.kind?.includes("light") ? "vs" : "vs-dark",
		})
	}, [theme])

	// 4) Initialize Monaco Editor once.
	useEffect(() => {
		if (!monacoContainerRef.current) return

		editorRef.current = monaco.editor.create(monacoContainerRef.current, {
			value,
			language: "promptTemplate",
			// Rely on VS Code’s default theme or manually set it if needed
			theme: theme.kind?.includes("light") ? "vs" : "vs-dark",
			placeholder: "Enter your prompt template here... or {{ to see placeholders }}",
			automaticLayout: true,
			minimap: { enabled: false },
			fontSize: 13,
			lineNumbers: "off",
		})

		const model = editorRef.current.getModel()
		const onChangeSubscription = model?.onDidChangeContent(() => {
			const newValue = model?.getValue() || ""
			setValue(newValue)
		})

		// 5) Only register once. We'll check if the text ends with "{{".
		const completionProvider = monaco.languages.registerCompletionItemProvider("promptTemplate", {
			triggerCharacters: ["{"],
			provideCompletionItems: (model, position) => {
				const textUntilPosition = model.getValueInRange({
					startLineNumber: position.lineNumber,
					startColumn: 1,
					endLineNumber: position.lineNumber,
					endColumn: position.column,
				})

				// We only trigger if the user typed exactly '{{'
				if (!textUntilPosition.endsWith("{{")) {
					return { suggestions: [] }
				}

				// Build suggestions from placeholders
				const suggestions: monaco.languages.CompletionItem[] = Object.keys(TEMPLATE_PLACEHOLDERS).map((key) => {
					let insertText = `{${key}}}`
					let label = `{{${key}}}`

					// If it's 'vision', insert a snippet block
					if (key === "vision") {
						insertText = `{#vision}}\nYour vision analysis here...\n{{/vision}}`
						label = "{{#vision}} ... {{/vision}}"
					}

					// Provide better documentation as markdown
					return {
						label,
						kind: monaco.languages.CompletionItemKind.Snippet,
						insertText,
						insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
						detail: key,
						documentation: {
							value: `**${key}**\n\n${
								TEMPLATE_PLACEHOLDERS[key as keyof typeof TEMPLATE_PLACEHOLDERS].description
							}`,
							isTrusted: true,
						},
						range: new monaco.Range(
							position.lineNumber,
							position.column - 1,
							position.lineNumber,
							position.column
						),
					}
				})

				return { suggestions }
			},
		})

		return () => {
			onChangeSubscription?.dispose()
			completionProvider.dispose()
			editorRef.current?.dispose()
		}
	}, [])

	// 6) Prompt actions messaging
	const handleMessage = useCallback((event: MessageEvent) => {
		promptActions.handleMessage(event.data, {
			onTemplateLoaded: (content, name) => {
				setValue(content)
				editorRef.current?.setValue(content)
				setLoadedTemplateName(name)
				// record the original state so we can detect unsaved changes
				setOriginalTemplateName(name)
				setOriginalTemplateContent(content)
			},
			onTemplateSaved: (savedName) => {
				// Once saved, reflect that in local state as well
				setLoadedTemplateName(savedName)
				// Because we just successfully saved, treat the
				// current content as the "original" now
				setOriginalTemplateName(savedName)
				setOriginalTemplateContent(value)
			},
			onPromptPreviewed: (content, visible) => {
				setPreview(visible)
				setPreviewValue(content)
			},
			onTemplatesList: (templatesList, activeName) => {
				setTemplates(
					templatesList.map((name) => ({
						name,
						isActive: name === activeName,
					}))
				)
				setActiveTemplate(activeName)
			},
			onActiveTemplateUpdated: (templateName) => {
				setActiveTemplate(templateName)
				setTemplates((prev) => prev.map((t) => ({ ...t, isActive: t.name === templateName })))
			},
		})
	}, [])

	useEvent("message", handleMessage)

	useEffect(() => {
		if (showLoadDialog) {
			promptActions.listTemplates()
		}
	}, [showLoadDialog])

	useEffect(() => {
		// Load the template list on mount
		promptActions.listTemplates()
	}, [])

	// 7) Save / Load
	const handleSave = useCallback(() => {
		if (templateName.trim()) {
			promptActions.saveTemplate(templateName.trim(), value)
			setShowSaveDialog(false)
			setTemplateName("")
		}
	}, [templateName, value])

	const handleLoad = useCallback((template: string) => {
		promptActions.loadTemplate(template)
		setShowLoadDialog(false)
	}, [])

	const handleSetActive = useCallback((templateName: string | null) => {
		promptActions.setActiveTemplate(templateName)
	}, [])

	// 8) Misc. Editor actions
	const clearEditor = () => {
		setValue("")
		setPreviewValue("")
		editorRef.current?.setValue("")
	}

	const handleCopy = useCallback(() => {
		navigator.clipboard.writeText(value).then(() => {
			setShowCopiedAlert(true)
			setTimeout(() => setShowCopiedAlert(false), 2000)
		})
	}, [value])

	/**
	 * Decide what to show as "Viewing:":
	 * 1) If no loaded template => "None"
	 * 2) If loadedTemplateName is not in templates => "Unsaved template"
	 * 3) If the content changed => "Unsaved changes"
	 * 4) Else => show the loadedTemplateName
	 */
	const getViewingLabel = (): string => {
		if (!loadedTemplateName) {
			return "None"
		}
		const exists = templates.some((t) => t.name === loadedTemplateName)
		if (!exists) {
			return "Unsaved template"
		}
		// check for changes in name or content
		const nameChanged = loadedTemplateName !== originalTemplateName
		const contentChanged = value !== originalTemplateContent
		if (nameChanged || contentChanged) {
			return "Unsaved changes"
		}
		return loadedTemplateName
	}

	return (
		<>
			<Card className="w-full">
				<CardHeader>
					<CardTitle className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<span>Prompt Template Editor</span>
							{activeTemplate && (
								<span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded-full">
									Active: {activeTemplate}
								</span>
							)}
						</div>
						<div className="flex gap-2">
							<Button
								variant="ghost"
								size="sm"
								onClick={() => promptActions.closeEditor()}
								className="flex items-center gap-2">
								<X className="w-4 h-4" />
							</Button>
							<Button
								variant="outline"
								size="sm"
								onClick={() => {
									promptActions.previewPrompt(value, !preview)
								}}
								className="flex items-center gap-2">
								{preview ? <FileEdit className="w-4 h-4" /> : <Fullscreen className="w-4 h-4" />}
								{preview ? "Show Editor" : "Show Preview"}
							</Button>
							<Button
								variant="outline"
								size="sm"
								onClick={() => setShowLoadDialog(true)}
								className="flex items-center gap-2">
								<FolderOpen className="w-4 h-4" />
								Load
							</Button>
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

				{/* If the template we're currently viewing is different than the active template */}
				<div className="px-6 -mt-2 mb-2">
					<span className="text-xs bg-muted px-2 py-1 rounded-full">Viewing: {getViewingLabel()}</span>
				</div>

				<CardContent>
					<div className="space-y-4">
						{/* Monaco Editor container */}
						<div className="relative w-full h-64 border rounded-md overflow-hidden">
							{preview && (
								<ScrollArea
									viewProps={{
										className: "max-h-96 px-6 pt-0 bg-card",
									}}>
									<div className="whitespace-pre-wrap">{previewValue}</div>
									<ScrollBar forceMount />
								</ScrollArea>
							)}
							<div ref={monacoContainerRef} className={cn("w-full h-full", preview && "hidden")} />
						</div>

						<div className="space-y-2">
							<ToolCards />
						</div>
					</div>
				</CardContent>
			</Card>

			{/* SAVE DIALOG */}
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

			{/* LOAD DIALOG */}
			<Dialog open={showLoadDialog} onOpenChange={setShowLoadDialog}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Load Template</DialogTitle>
					</DialogHeader>
					<div className="space-y-4 py-4">
						<div className="space-y-2">
							{templates.length === 0 ? (
								<div className="text-center text-muted-foreground">No templates found</div>
							) : (
								<div className="space-y-2">
									{templates.map((template) => (
										<div key={template.name} className="flex items-center gap-2">
											<Button
												variant={template.isActive ? "default" : "outline"}
												className="w-full justify-start"
												onClick={() => handleLoad(template.name)}>
												{template.name}
												{template.isActive && (
													<span className="ml-2 text-xs bg-primary/20 px-2 py-1 rounded">
														Active
													</span>
												)}
											</Button>
											<div className="flex gap-2">
												<Button
													variant="ghost"
													size="sm"
													onClick={() =>
														handleSetActive(template.isActive ? null : template.name)
													}>
													{template.isActive ? "Deactivate" : "Set Active"}
												</Button>
												{template.name !== "default" && (
													<Button
														variant="ghost"
														size="sm"
														onClick={() => {
															promptActions.deleteTemplate(template.name)
														}}>
														Delete
													</Button>
												)}
											</div>
										</div>
									))}
								</div>
							)}
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setShowLoadDialog(false)}>
							Cancel
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{showCopiedAlert && (
				<Alert variant="info" className="fixed bottom-4 right-4 w-auto">
					<AlertDescription>Template copied to clipboard!</AlertDescription>
				</Alert>
			)}
		</>
	)
}

export default PromptEditor
