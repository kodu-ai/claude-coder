import * as vscode from "vscode";
export declare const DIFF_VIEW_URI_SCHEME = "claude-coder-diff";
export declare const MODIFIED_URI_SCHEME = "claude-coder-modified";
export declare const INLINE_DIFF_VIEW_URI_SCHEME = "claude-coder-inline-diff";
export declare const INLINE_MODIFIED_URI_SCHEME = "claude-coder-inline-modified";
export declare const fadedOverlayDecorationType: vscode.TextEditorDecorationType;
export declare const activeLineDecorationType: vscode.TextEditorDecorationType;
type DecorationType = "fadedOverlay" | "activeLine";
export declare class DecorationController {
    private decorationType;
    private editor;
    private ranges;
    constructor(decorationType: DecorationType, editor: vscode.TextEditor);
    getDecoration(): vscode.TextEditorDecorationType;
    addLines(startIndex: number, numLines: number): void;
    clear(): void;
    updateOverlayAfterLine(line: number, totalLines: number): void;
    setActiveLine(line: number): void;
}
export declare class ModifiedContentProvider implements vscode.FileSystemProvider {
    private content;
    private _emitter;
    readonly onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]>;
    private pendingUpdates;
    watch(uri: vscode.Uri): vscode.Disposable;
    stat(uri: vscode.Uri): vscode.FileStat;
    readDirectory(): [string, vscode.FileType][];
    createDirectory(): void;
    readFile(uri: vscode.Uri): Uint8Array;
    writeFile(uri: vscode.Uri, content: Uint8Array, options: {
        create: boolean;
        overwrite: boolean;
    }): Promise<void>;
    delete(uri: vscode.Uri): void;
    rename(): void;
}
export {};
