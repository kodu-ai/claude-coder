import * as vscode from "vscode"
import path from "path"
import { promises as fs } from "fs"

interface PromptState {
    activePromptName: string | null
    defaultPromptContent: string
}

export class PromptStateManager {
    private static instance: PromptStateManager
    private context: vscode.ExtensionContext
    private state: PromptState

    private constructor(context: vscode.ExtensionContext) {
        this.context = context
        this.state = {
            activePromptName: null,
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
        // Load active prompt name from global state
        this.state.activePromptName = this.context.globalState.get<string | null>("activePromptName", null)
        
        // Load default prompt content from extension's default prompt file
        try {
            const defaultPromptPath = path.join(this.context.extensionPath, "src", "agent", "v1", "prompts", "main.prompt.ts")
            const defaultPromptContent = await fs.readFile(defaultPromptPath, "utf-8")
            this.state.defaultPromptContent = defaultPromptContent
        } catch (error) {
            console.error("Failed to load default prompt:", error)
            // Set a basic fallback prompt if loading fails
            this.state.defaultPromptContent = "You are an AI assistant."
        }
    }

    private async saveState(): Promise<void> {
        await this.context.globalState.update("activePromptName", this.state.activePromptName)
    }

    private getTemplatesDir(): string {
        return path.join(this.context.globalStorageUri.fsPath, "templates")
    }

    public async saveTemplate(name: string, content: string): Promise<void> {
        const templatesDir = this.getTemplatesDir()
        await fs.mkdir(templatesDir, { recursive: true })
        
        const templatePath = path.join(templatesDir, `${name}.txt`)
        await fs.writeFile(templatePath, content)
    }

    public async loadTemplate(name: string): Promise<string> {
        const templatePath = path.join(this.getTemplatesDir(), `${name}.txt`)
        return await fs.readFile(templatePath, "utf-8")
    }

    public async listTemplates(): Promise<string[]> {
        try {
            const templatesDir = this.getTemplatesDir()
            await fs.mkdir(templatesDir, { recursive: true })
            
            const files = await fs.readdir(templatesDir)
            return files
                .filter(file => file.endsWith(".txt"))
                .map(file => file.slice(0, -4))
        } catch (error) {
            console.error("Failed to list templates:", error)
            return []
        }
    }

    public async setActivePrompt(name: string | null): Promise<void> {
        this.state.activePromptName = name
        await this.saveState()
    }

    public getActivePromptName(): string | null {
        return this.state.activePromptName
    }

    public async getActivePromptContent(): Promise<string> {
        if (!this.state.activePromptName) {
            return this.state.defaultPromptContent
        }

        try {
            return await this.loadTemplate(this.state.activePromptName)
        } catch (error) {
            console.error("Failed to load active prompt, falling back to default:", error)
            return this.state.defaultPromptContent
        }
    }

    public async deleteTemplate(name: string): Promise<void> {
        const templatePath = path.join(this.getTemplatesDir(), `${name}.txt`)
        await fs.unlink(templatePath)
        
        // If this was the active prompt, reset to default
        if (this.state.activePromptName === name) {
            await this.setActivePrompt(null)
        }
    }

    public getDefaultPromptContent(): string {
        return this.state.defaultPromptContent
    }
}