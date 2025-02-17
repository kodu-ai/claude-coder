import { BaseAgentTool } from "../base-agent.tool";
import { AttemptCompletionToolParams } from "../schema/attempt_completion";
export declare class AttemptCompletionTool extends BaseAgentTool<AttemptCompletionToolParams> {
    execute(): Promise<{
        branch?: string | undefined;
        commitHash?: string | undefined;
        preCommitHash?: string;
        toolName: "spawn_agent" | "execute_command" | "list_files" | "explore_repo_folder" | "search_files" | "read_file" | "write_to_file" | "ask_followup_question" | "attempt_completion" | "web_search" | "server_runner" | "url_screenshot" | "search_symbol" | "add_interested_file" | "file_changes_plan" | "file_editor" | "exit_agent" | "submit_review" | "reject_file_changes" | "edit_file_blocks";
        toolId: string;
        text: string | undefined;
        images: string[] | undefined;
        status: "rejected" | "error" | "success" | "feedback";
    }>;
}
