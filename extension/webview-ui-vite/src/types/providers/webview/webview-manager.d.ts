import * as vscode from "vscode";
import { ClaudeMessage, ExtensionMessage } from "../../shared/messages/extension-message";
import { ExtensionProvider } from "../extension-provider";
/**
 * Represents an item in the file tree structure.
 * Used to display and manage hierarchical file/folder organization in the webview.
 */
interface FileTreeItem {
    /** Unique identifier for the item */
    id: string;
    /** Display name of the file or folder */
    name: string;
    /** Child items for folders */
    children?: FileTreeItem[];
    /** Nesting level in the tree structure */
    depth: number;
    /** Indicates whether this is a file or folder */
    type: "file" | "folder";
}
/**
 * Manages the webview interface for the Claude Coder extension.
 * Handles communication between the extension and webview, manages state updates,
 * and provides functionality for file system operations and user interactions.
 */
export declare class WebviewManager {
    readonly provider: ExtensionProvider;
    /** ID of the latest announcement to show to users */
    private static readonly latestAnnouncementId;
    private promptManager;
    /**
     * Creates a new WebviewManager instance
     * @param provider The extension provider that owns this webview manager
     */
    constructor(provider: ExtensionProvider);
    /**
     * Initializes and configures a webview instance
     * Sets up message listeners, HTML content, and visibility handlers
     * @param webviewView The webview or webview panel to setup
     */
    setupWebview(webviewView: vscode.WebviewView | vscode.WebviewPanel): void;
    /**
     * Shows an input box to collect user input
     * @param options Configuration options for the input box
     * @returns Promise that resolves to the user's input or undefined if cancelled
     */
    showInputBox(options: vscode.InputBoxOptions): Promise<string | undefined>;
    /**
     * Posts a message to the webview with debouncing to prevent too frequent updates
     * while ensuring messages are not delayed too long
     * @param message The message to send to the webview
     */
    postMessageToWebview(message: ExtensionMessage): Promise<boolean | undefined>;
    /**
     * only post claude messages to webview
     */
    postClaudeMessagesToWebview(msgs?: ClaudeMessage[] | null): Promise<boolean | undefined>;
    postClaudeMessageToWebview(msg: ClaudeMessage): Promise<boolean | undefined>;
    postBaseStateToWebview(): Promise<void>;
    private getBaseStateToPostToWebview;
    private getHtmlContent;
    /**
     * Recursively builds a tree structure of files and folders in a directory
     * Excludes specified directories to keep the tree clean and relevant
     * @param dir The directory path to scan
     * @param parentId The ID of the parent node in the tree
     * @returns Promise resolving to an array of FileTreeItems representing the directory structure
     */
    getFileTree(dir: string, parentId?: string): Promise<FileTreeItem[]>;
    /**
     * Sets up message handling for the webview
     * Processes various message types from the webview and triggers appropriate actions
     * @param webview The webview instance to attach the message listener to
     */
    private setWebviewMessageListener;
    private handleDebugInstruction;
    /**
     * Cleanup method to be called when the webview manager is disposed
     */
    dispose(): void;
}
export {};
