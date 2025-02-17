import { WebviewMessage } from "../../shared/messages/client-message";
import { ExtensionMessage } from "../../shared/messages/extension-message";
import { WebviewManager } from "./webview-manager";
export declare class PromptManager {
    private webviewManager;
    private promptEditorPanel;
    constructor(webviewManager: WebviewManager);
    private getPromptEditorHtmlContent;
    private createPromptEditorPanel;
    private showPromptEditor;
    /**
     * Handles debug instructions for the extension
     * Analyzes open tabs in the workspace and collects diagnostic information
     * Creates a new task if needed and processes debugging information
     * @returns Promise that resolves when debug handling is complete
     */
    /**
     * Handles saving a prompt template to disk
     * @param templateName The name of the template to save
     * @param content The template content
     */
    private savePromptTemplate;
    postMessageToWebview(message: ExtensionMessage): Promise<boolean | undefined>;
    private listPromptTemplates;
    private loadPromptTemplate;
    private setActivePrompt;
    private deleteTemplate;
    private setWebviewMessageListener;
    handleMessage(message: WebviewMessage): Promise<void>;
}
