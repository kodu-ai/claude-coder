import { DiffViewProvider } from "../../../../../integrations/editor/diff-view-provider";
import { BaseAgentTool, FullToolParams } from "../../base-agent.tool";
import { AgentToolOptions } from "../../types";
import { InlineEditHandler } from "../../../../../integrations/editor/inline-editor";
import { ToolResponseV2 } from "../../../types";
import { FileEditorToolParams } from "../../schema/file_editor_tool";
export declare class FileEditorTool extends BaseAgentTool<FileEditorToolParams> {
    diffViewProvider: DiffViewProvider;
    inlineEditor: InlineEditHandler;
    private isProcessingFinalContent;
    private pQueue;
    private skipWriteAnimation;
    private fileState?;
    private diffBlockManager;
    private finalizedBlockIds;
    constructor(params: FullToolParams<FileEditorToolParams>, options: AgentToolOptions);
    execute(): Promise<ToolResponseV2>;
    private commitXMLGenerator;
    handlePartialUpdateDiff(relPath: string, diff: string): Promise<void>;
    private _handlePartialUpdateDiff;
    handlePartialUpdate(relPath: string, acculmatedContent: string): Promise<void>;
    private finalizeInlineEdit;
    private finalizeFileEdit;
    private processFileWrite;
    abortToolExecution(): Promise<{
        didAbort: boolean;
    }>;
    private showChangesInDiffView;
    /**
     * Saves a new file version after changes are made to the file.
     */
    private saveNewFileVersion;
    private handleRollback;
}
