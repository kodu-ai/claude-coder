import * as vscode from "vscode"
import path from "path"
import { promises as fs } from "fs"
import { mainPrompts } from "../../agent/v1/prompts/main.prompt"
import { GlobalStateManager } from "./global-state-manager"

interface PromptState {
	activePromptName: string
	defaultPromptContent: string
}

export class PromptStateManager {
	private static instance: PromptStateManager
	private context: vscode.ExtensionContext
	private state: PromptState
	private readonly DEFAULT_PROMPT_NAME = "default"

	private constructor(context: vscode.ExtensionContext) {
		this.context = context
		this.state = {
			activePromptName: this.DEFAULT_PROMPT_NAME,
			defaultPromptContent: "", // Will be initialized in init()
		}
	}

	public static getInstance(): PromptStateManager {
		if (!PromptStateManager.instance) {
			throw new Error("PromptStateManager not initialized")
		}
		return PromptStateManager.instance
	}

	public static async init(context: vscode.ExtensionContext): Promise<PromptStateManager> {
		if (!PromptStateManager.instance) {
			PromptStateManager.instance = new PromptStateManager(context)
			await PromptStateManager.instance.loadState()
		}
		return PromptStateManager.instance
	}

	private async loadState(): Promise<void> {
		// Load active prompt name from global state, default to DEFAULT_PROMPT_NAME if not set
		this.state.activePromptName =
			GlobalStateManager.getInstance().getGlobalState("activePromptName") || this.DEFAULT_PROMPT_NAME

		// Load default prompt content from extension's default prompt file
		try {
			this.state.defaultPromptContent = mainPrompts.template
		} catch (error) {
			console.error("Failed to load default prompt:", error)
			// Set a basic fallback prompt if loading fails
			this.state.defaultPromptContent = "You are an AI assistant."
		}
	}

	private async saveState(): Promise<void> {
		await GlobalStateManager.getInstance().updateGlobalState("activePromptName", this.state.activePromptName)
	}

	private getTemplatesDir(): string {
		return path.join(this.context.globalStorageUri.fsPath, "templates")
	}

	public async saveTemplate(name: string, content: string): Promise<void> {
		if (name === this.DEFAULT_PROMPT_NAME) {
			throw new Error("Cannot modify the default prompt template")
		}

		const templatesDir = this.getTemplatesDir()
		await fs.mkdir(templatesDir, { recursive: true })

		const templatePath = path.join(templatesDir, `${name}.txt`)
		await fs.writeFile(templatePath, content)
	}

	public async loadTemplate(name: string): Promise<string> {
		if (name === this.DEFAULT_PROMPT_NAME) {
			return this.state.defaultPromptContent
		}

		const templatePath = path.join(this.getTemplatesDir(), `${name}.txt`)
		return await fs.readFile(templatePath, "utf-8")
	}

	public async listTemplates(): Promise<string[]> {
		try {
			const templatesDir = this.getTemplatesDir()
			await fs.mkdir(templatesDir, { recursive: true })

			const files = await fs.readdir(templatesDir)
			const templates = files.filter((file) => file.endsWith(".txt")).map((file) => file.slice(0, -4))

			// Always include default template at the top of the list
			return [this.DEFAULT_PROMPT_NAME, ...templates]
		} catch (error) {
			console.error("Failed to list templates:", error)
			return [this.DEFAULT_PROMPT_NAME]
		}
	}

	public async setActivePrompt(name: string | null): Promise<void> {
		// If name is null or undefined, set to default
		this.state.activePromptName = name || this.DEFAULT_PROMPT_NAME
		await this.saveState()
	}

	public getActivePromptName(): string {
		return this.state.activePromptName
	}

	public async getActivePromptContent(): Promise<string> {
		try {
			if (this.state.activePromptName === this.DEFAULT_PROMPT_NAME) {
				return this.state.defaultPromptContent
			}
			return await this.loadTemplate(this.state.activePromptName)
		} catch (error) {
			console.error("Failed to load active prompt, falling back to default:", error)
			return this.state.defaultPromptContent
		}
	}

	public async deleteTemplate(name: string): Promise<void> {
		if (name === this.DEFAULT_PROMPT_NAME) {
			throw new Error("Cannot delete the default prompt template")
		}

		const templatePath = path.join(this.getTemplatesDir(), `${name}.txt`)
		await fs.unlink(templatePath)

		// If this was the active prompt, reset to default
		if (this.state.activePromptName === name) {
			await this.setActivePrompt(this.DEFAULT_PROMPT_NAME)
		}
	}

	public getDefaultPromptContent(): string {
		return this.state.defaultPromptContent
	}
}
