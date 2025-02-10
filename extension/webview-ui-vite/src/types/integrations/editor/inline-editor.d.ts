import * as vscode from "vscode";
import { BlockResult, EditBlock } from "./utils";
interface DocumentState {
    uri: vscode.Uri;
    originalContent: string;
    currentContent: string;
    editBlocks: Map<string, EditBlock>;
    editBlocksInsertionIndex: Map<string, number>;
    lastInsertionIndex: number;
    lastUpdateResults?: BlockResult[];
}
/**
 * This class uses a diff editor to display changes:
 * - Left side: original file (read-only)
 * - Right side: a virtual doc managed by ModifiedContentProvider (updated in-memory)
 *
 * After applying edits, we always scroll to the last inserted edit block, ensuring the most recently added block is visible.
 *
 * Changes:
 * - Added `forceFinalize()` method.
 * - Normalized line endings to handle Windows environments better.
 * - Removed usage of `vscode.workspace.asRelativePath` for the diff title to reduce path issues on Windows.
 * - Added small delays to help ensure updates propagate in environments where timing is an issue.
 */
export declare class InlineEditHandler {
    private isAutoScrollEnabled;
    protected currentDocumentState: DocumentState | undefined;
    private modifiedUri?;
    private originalUri?;
    private isDisposed;
    private static modifiedContentProvider;
    constructor();
    open(id: string, filePath: string, searchContent: string): Promise<void>;
    /**
     * Open a diff editor: left side = original (virtual), right side = modified (virtual).
     * Use path.basename for display name to avoid path issues on Windows.
     */
    private openDiffEditor;
    applyStreamContent(id: string, searchContent: string, content: string): Promise<void>;
    applyFinalContent(id: string, searchContent: string, replaceContent: string): Promise<void>;
    private validateDocumentState;
    isOpen(): boolean;
    private updateFileContent;
    private scrollToLine;
    saveChanges(): Promise<{
        /**
         * The final content of the file after applying all changes.
         * Formatted with line numbers for each line.
         */
        finalContent: string;
        results: BlockResult[];
        userEdits?: string;
        finalContentRaw: string;
    }>;
    closeDiffEditors(): Promise<void>;
    rejectChanges(): Promise<void>;
    /**
     * Force finalize all given blocks by applying their final content and marking them as final,
     * then re-applying changes to ensure everything is updated.
     */
    forceFinalize(blocks: {
        id: string;
        searchContent: string;
        replaceContent: string;
    }[]): Promise<{
        failedCount: number;
        isAllFailed: boolean;
        isAnyFailed: boolean;
        failedBlocks?: BlockResult[];
        results: BlockResult[];
    }>;
    setAutoScroll(enabled: boolean): void;
    dispose(): void;
    private logger;
}
export {};
