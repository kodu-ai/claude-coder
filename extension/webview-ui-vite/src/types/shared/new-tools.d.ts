import { SpawnAgentOptions } from "../agent/v1/tools/schema/agents/agent-spawner";
import { ToolStatus } from "./messages/extension-message";
/**
 * This is the input and output for execute_command tool
 */
export type ExecuteCommandTool = {
    tool: "execute_command";
    /**
     * the command to execute
     */
    command: string;
    /**
     * the output of the command
     */
    output?: string;
    /**
     * this is a long running command so ask user if they want to continue
     */
    earlyExit?: "pending" | "approved" | "rejected";
    commitHash?: string;
    branch?: string;
};
export type ListFilesTool = {
    tool: "list_files";
    path: string;
    recursive?: "true" | "false";
    content?: string;
};
export type ExploreRepoFolderTool = {
    tool: "explore_repo_folder";
    path: string;
    content?: string;
};
export type SearchFilesTool = {
    tool: "search_files";
    path: string;
    regex: string;
    filePattern?: string;
    content?: string;
};
export type ReadFileTool = {
    tool: "read_file";
    path: string;
    content: string;
    pageNumber?: number;
    readAllPages?: boolean;
};
export type WriteToFileTool = {
    tool: "write_to_file";
    mode?: "inline" | "whole";
    path: string;
    content?: string;
    diff?: string;
    notAppliedCount?: number;
    branch?: string;
    commitHash?: string;
};
export type AskFollowupQuestionTool = {
    tool: "ask_followup_question";
    question: string;
};
export type AttemptCompletionTool = {
    tool: "attempt_completion";
    command?: string;
    commandResult?: string;
    result: string;
};
export interface WebSearchTool {
    tool: "web_search";
    searchQuery: string;
    baseLink?: string;
    content?: string;
    browserModel?: "smart" | "fast";
    browserMode?: "api_docs" | "generic";
    streamType?: "start" | "explore" | "summarize" | "end";
}
export type ServerRunnerTool = {
    tool: "server_runner";
    port?: number;
    serverName?: string;
    commandType?: "start" | "stop" | "restart" | "getLogs";
    output?: string;
    commandToRun?: string;
    lines?: string;
};
export type UrlScreenshotTool = {
    tool: "url_screenshot";
    url: string;
    base64Image?: string;
};
export type UpsertMemoryTool = {
    tool: "upsert_memory";
    milestoneName?: string;
    summary?: string;
    content?: string;
};
export type SearchSymbolsTool = {
    tool: "search_symbol";
    symbolName: string;
    content?: string;
};
export type AddInterestedFileTool = {
    tool: "add_interested_file";
    path: string;
    why: string;
};
export type FileChangePlanTool = {
    tool: "file_changes_plan";
    path: string;
    what_to_accomplish: string;
    innerThoughts?: string;
    innerSelfCritique?: string;
    rejectedString?: string;
};
export type FileEditorTool = {
    tool: "file_editor";
    path: string;
    mode: "edit" | "whole_write" | "rollback" | "list_versions";
    kodu_content?: string;
    kodu_diff?: string;
    list_versions?: boolean;
    rollback_version?: string;
    list_versions_output?: string;
    saved_version?: string;
    notAppliedCount?: number;
    commitHash?: string;
    branch?: string;
};
export type SpawnAgentTool = {
    tool: "spawn_agent";
    agentName: SpawnAgentOptions;
    instructions: string;
    files?: string | string[];
};
export type ExitAgentTool = {
    tool: "exit_agent";
    agentName: SpawnAgentOptions;
    result: string;
};
export type SubmitReviewTool = {
    tool: "submit_review";
    review: string;
};
export type ChatTool = (ExitAgentTool | SpawnAgentTool | ExecuteCommandTool | ListFilesTool | ExploreRepoFolderTool | SearchFilesTool | ReadFileTool | WriteToFileTool | AskFollowupQuestionTool | AttemptCompletionTool | WebSearchTool | UrlScreenshotTool | ServerRunnerTool | SearchSymbolsTool | FileEditorTool | AddInterestedFileTool | FileChangePlanTool | SubmitReviewTool) & {
    ts: number;
    approvalState?: ToolStatus;
    /**
     * If this is a sub message, it will force it to stick to previous tool call in the ui (same message)
     */
    isSubMsg?: boolean;
    error?: string;
    userFeedback?: string;
};
export declare const readOnlyTools: ChatTool["tool"][];
export declare const mustRequestApprovalTypes: (ChatTool["tool"] | string)[];
export declare const mustRequestApprovalTools: ChatTool["tool"][];
