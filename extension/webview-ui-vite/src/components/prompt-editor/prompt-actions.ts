import { vscode } from "@/utils/vscode"
import {
	WebviewMessage,
	savePromptTemplateMessage,
	loadPromptTemplateMessage,
	setActivePromptMessage,
	ActionMessage,
} from "../../../../src/shared/messages/client-message"
import { ExtensionMessage } from "../../../../src/shared/messages/extension-message"
import { ToolName } from "../../../../src/agent/v1/tools/types"

interface MessageCallbacks {
	onTemplateSaved?: (templateName: string) => void
	onTemplateLoaded?: (content: string, id: string) => void
	onTemplatesList?: (templates: string[], activeTemplate: string | null) => void
	onActiveTemplateUpdated?: (templateName: string | null) => void
	onPromptPreviewed?: (content: string, visible: boolean) => void
}

export interface PromptTemplate {
	name: string
	content: string
	isActive: boolean
}

export class PromptActions {
	private static instance: PromptActions

	private constructor() {}

	public static getInstance(): PromptActions {
		if (!PromptActions.instance) {
			PromptActions.instance = new PromptActions()
		}
		return PromptActions.instance
	}

	public async saveTemplate(name: string, content: string): Promise<void> {
		vscode.postMessage({
			type: "savePromptTemplate",
			templateName: name.trim(),
			content,
		})
	}

	public async loadTemplate(name: string): Promise<void> {
		vscode.postMessage({
			type: "loadPromptTemplate",
			templateName: name,
		})
	}

	public async listTemplates(): Promise<void> {
		vscode.postMessage({
			type: "listPromptTemplates",
		})
	}

	public async setActiveTemplate(name: string | null): Promise<void> {
		vscode.postMessage({
			type: "setActivePrompt",
			templateName: name,
		})
	}

	public async deleteTemplate(name: string): Promise<void> {
		vscode.postMessage({
			type: "deletePromptTemplate",
			templateName: name,
		})
	}

	public closeEditor(): void {
		vscode.postMessage({
			type: "closePromptEditor",
		})
	}

	public previewPrompt(content: string, visible: boolean): void {
		vscode.postMessage({
			type: "previewPrompt",
			content,
			visible,
		})
	}

	public handleMessage(message: ExtensionMessage, callbacks: MessageCallbacks): void {
		switch (message.type) {
			case "templates_list":
				callbacks.onTemplatesList?.(message.templates, message.activeTemplate)
				break
			case "load_prompt_template":
				callbacks.onTemplateLoaded?.(message.content, message.promptId)
				break
			case "save_prompt_template":
				callbacks.onTemplateSaved?.(message.templateName)
				this.loadTemplate(message.templateName)
				this.setActiveTemplate(message.templateName)
				this.listTemplates()
				break

			case "previewPrompt":
				callbacks.onPromptPreviewed?.(message.content, message.visible)
				break

			case "set_active_prompt":
				callbacks.onActiveTemplateUpdated?.(message.templateName)
				break
			case "deletePromptTemplate":
				// After successful deletion, refresh the templates list and notify about the deletion
				this.listTemplates()
				callbacks.onTemplatesList?.([], null) // Reset templates list immediately
				break
		}
	}
}
