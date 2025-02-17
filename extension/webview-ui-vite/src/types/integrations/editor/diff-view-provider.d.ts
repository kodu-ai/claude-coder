/**
 * THIS FILE WAS CREATED BY KODU.AI v1.9.19 - https://kodu.ai/
 * THIS LETS KODU STREAM DIFF IN MEMORY AND SHOW IT IN VS CODE
 * ALSO IT UPDATES THE WORKSPACE TIMELINE WITH THE CHANGES
 */
import * as vscode from "vscode";
export declare class DiffViewProvider {
    private cwd;
    private updateQueue;
    private diffEditor?;
    originalContent: string;
    streamedContent: string;
    isEditing: boolean;
    relPath?: string;
    private originalUri?;
    private isFinalReached;
    private modifiedUri?;
    lastEditPosition?: vscode.Position;
    private lastScrollTime;
    private isAutoScrollEnabled;
    private lastUserInteraction;
    private previousLines;
    private static readonly SCROLL_THROTTLE;
    private static readonly USER_INTERACTION_TIMEOUT;
    private static readonly SCROLL_THRESHOLD;
    private static modifiedContentProvider;
    private disposables;
    private activeLineController?;
    private fadedOverlayController?;
    private currentDocument;
    private lastModifiedLine;
    constructor(cwd: string);
    open(relPath: string, isFinal?: boolean): Promise<void>;
    private setupEventListeners;
    openDiffEditor(relPath: string, isFinal?: boolean): Promise<void>;
    update(accumulatedContent: string, isFinal: boolean): Promise<void>;
    private applyLineByLineUpdate;
    private scrollToModifiedLine;
    private checkScrollPosition;
    private applyUpdate;
    revertChanges(): Promise<void>;
    reset(): Promise<void>;
    saveChanges(): Promise<{
        userEdits: string | undefined;
        finalContent: string;
    }>;
    private createPrettyPatch;
    isDiffViewOpen(): boolean;
    private closeAllDiffViews;
    private logger;
}
