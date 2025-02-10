import { MainAgent } from "../main-agent";
import { ToolResponse, ToolResponseV2 } from "../types";
import { AgentToolOptions, AgentToolParams, CommitInfo, ToolParams } from "./types";
export type FullToolParams<T extends ToolParams> = T & {
    id: string;
    ts: number;
    isSubMsg?: boolean;
    isLastWriteToFile: boolean;
    isFinal?: boolean;
    ask: AgentToolParams["ask"];
    say: AgentToolParams["say"];
    updateAsk: AgentToolParams["updateAsk"];
    returnEmptyStringOnSuccess?: boolean;
};
export declare abstract class BaseAgentTool<T extends ToolParams> {
    protected cwd: string;
    protected alwaysAllowReadOnly: boolean;
    protected alwaysAllowWriteOnly: boolean;
    protected koduDev: MainAgent;
    protected isAbortingTool: boolean;
    protected setRunningProcessId: (pid: number | undefined) => void;
    protected AbortController: AbortController;
    protected params: FullToolParams<T>;
    constructor(params: FullToolParams<T>, options: AgentToolOptions);
    get name(): "spawn_agent" | "execute_command" | "list_files" | "explore_repo_folder" | "search_files" | "read_file" | "write_to_file" | "ask_followup_question" | "attempt_completion" | "web_search" | "server_runner" | "url_screenshot" | "search_symbol" | "add_interested_file" | "file_changes_plan" | "file_editor" | "exit_agent" | "submit_review" | "reject_file_changes" | "edit_file_blocks";
    get id(): string;
    get ts(): number;
    get paramsInput(): AgentToolParams["input"];
    get toolParams(): AgentToolParams;
    get isFinal(): boolean;
    abstract execute(params: AgentToolParams): Promise<ToolResponseV2>;
    updateParams(input: AgentToolParams["input"]): void;
    updateIsFinal(isFinal: boolean): void;
    formatToolDeniedFeedback(feedback?: string): string;
    formatGenericToolFeedback(feedback?: string): string;
    formatToolDenied(): string;
    formatToolResult(result: string): Promise<string>;
    formatToolError(error?: string): string;
    formatToolResponseWithImages(text: string, images?: string[]): ToolResponse;
    abortToolExecution(): Promise<{
        didAbort: boolean;
    }>;
    protected toolResponse(status: ToolResponseV2["status"], text?: string, images?: string[], commitResult?: CommitInfo): {
        branch?: string | undefined;
        commitHash?: string | undefined;
        preCommitHash?: string;
        toolName: "spawn_agent" | "execute_command" | "list_files" | "explore_repo_folder" | "search_files" | "read_file" | "write_to_file" | "ask_followup_question" | "attempt_completion" | "web_search" | "server_runner" | "url_screenshot" | "search_symbol" | "add_interested_file" | "file_changes_plan" | "file_editor" | "exit_agent" | "submit_review" | "reject_file_changes" | "edit_file_blocks";
        toolId: string;
        text: string | undefined;
        images: string[] | undefined;
        status: "rejected" | "error" | "success" | "feedback";
    };
    protected get options(): AgentToolOptions;
    protected logger(message: string, level?: "info" | "warn" | "error" | "debug"): void;
}
