import * as vscode from "vscode";
export declare class PromptStateManager {
    private static instance;
    private context;
    private state;
    private readonly DEFAULT_PROMPT_NAME;
    private constructor();
    static getInstance(): PromptStateManager;
    static init(context: vscode.ExtensionContext): Promise<PromptStateManager>;
    private loadState;
    private saveState;
    private getTemplatesDir;
    saveTemplate(name: string, content: string): Promise<void>;
    loadTemplate(name: string): Promise<string>;
    listTemplates(): Promise<string[]>;
    setActivePrompt(name: string | null): Promise<void>;
    getActivePromptName(): string;
    getActivePromptContent(): Promise<string>;
    deleteTemplate(name: string): Promise<void>;
    getDefaultPromptContent(): string;
}
