import { executeCommandTool } from "./execute_command";
import { listFilesTool } from "./list_files";
import { ExploreRepoFolderTool } from "./explore-repo-folder.schema";
import { searchFilesTool } from "./search_files";
import { readFileTool } from "./read_file";
import { writeToFileTool } from "./write_to_file";
import { askFollowupQuestionTool } from "./ask_followup_question";
import { attemptCompletionTool } from "./attempt_completion";
import { webSearchTool } from "./web_search";
import { urlScreenshotTool } from "./url_screenshot";
import { searchSymbolTool } from "./search_symbols";
import { addInterestedFileTool } from "./add_interested_file";
import { fileEditorTool } from "./file_editor_tool";
import { spawnAgentTool } from "./agents/agent-spawner";
import { exitAgentTool } from "./agents/agent-exit";
export declare const tools: readonly [{
    schema: {
        name: string;
        schema: import("zod").ZodObject<{
            command: import("zod").ZodString;
        }, "strip", import("zod").ZodTypeAny, {
            command: string;
        }, {
            command: string;
        }>;
    };
    examples: string[];
}, {
    schema: {
        name: string;
        schema: import("zod").ZodObject<{
            path: import("zod").ZodString;
            recursive: import("zod").ZodOptional<import("zod").ZodEnum<["true", "false"]>>;
        }, "strip", import("zod").ZodTypeAny, {
            path: string;
            recursive?: "true" | "false" | undefined;
        }, {
            path: string;
            recursive?: "true" | "false" | undefined;
        }>;
    };
    examples: string[];
}, {
    schema: {
        name: string;
        schema: import("zod").ZodObject<{
            path: import("zod").ZodString;
        }, "strip", import("zod").ZodTypeAny, {
            path: string;
        }, {
            path: string;
        }>;
    };
    examples: string[];
}, {
    schema: {
        name: string;
        schema: import("zod").ZodObject<{
            path: import("zod").ZodString;
            regex: import("zod").ZodString;
            filePattern: import("zod").ZodOptional<import("zod").ZodString>;
        }, "strip", import("zod").ZodTypeAny, {
            path: string;
            regex: string;
            filePattern?: string | undefined;
        }, {
            path: string;
            regex: string;
            filePattern?: string | undefined;
        }>;
    };
    examples: string[];
}, {
    schema: {
        name: string;
        schema: import("zod").ZodObject<{
            path: import("zod").ZodString;
        }, "strip", import("zod").ZodTypeAny, {
            path: string;
        }, {
            path: string;
        }>;
    };
    examples: string[];
}, {
    schema: {
        name: string;
        schema: import("zod").ZodObject<{
            question: import("zod").ZodString;
        }, "strip", import("zod").ZodTypeAny, {
            question: string;
        }, {
            question: string;
        }>;
    };
    examples: string[];
}, {
    schema: {
        name: string;
        schema: import("zod").ZodObject<{
            result: import("zod").ZodString;
        }, "strip", import("zod").ZodTypeAny, {
            result: string;
        }, {
            result: string;
        }>;
    };
    examples: string[];
}, {
    schema: {
        name: string;
        schema: import("zod").ZodObject<{
            searchQuery: import("zod").ZodString;
            baseLink: import("zod").ZodOptional<import("zod").ZodString>;
            browserModel: import("zod").ZodOptional<import("zod").ZodDefault<import("zod").ZodEnum<["smart", "fast"]>>>;
            browserMode: import("zod").ZodOptional<import("zod").ZodDefault<import("zod").ZodEnum<["api_docs", "generic"]>>>;
        }, "strip", import("zod").ZodTypeAny, {
            searchQuery: string;
            baseLink?: string | undefined;
            browserModel?: "smart" | "fast" | undefined;
            browserMode?: "api_docs" | "generic" | undefined;
        }, {
            searchQuery: string;
            baseLink?: string | undefined;
            browserModel?: "smart" | "fast" | undefined;
            browserMode?: "api_docs" | "generic" | undefined;
        }>;
    };
    examples: string[];
}, {
    schema: {
        name: string;
        schema: import("zod").ZodObject<{
            url: import("zod").ZodString;
        }, "strip", import("zod").ZodTypeAny, {
            url: string;
        }, {
            url: string;
        }>;
    };
    examples: string[];
}, {
    schema: {
        name: string;
        schema: import("zod").ZodObject<{
            commandType: import("zod").ZodOptional<import("zod").ZodEnum<["start", "stop", "restart", "getLogs"]>>;
            serverName: import("zod").ZodOptional<import("zod").ZodString>;
            commandToRun: import("zod").ZodOptional<import("zod").ZodString>;
            lines: import("zod").ZodOptional<import("zod").ZodDefault<import("zod").ZodString>>;
        }, "strip", import("zod").ZodTypeAny, {
            commandToRun?: string | undefined;
            commandType?: "start" | "stop" | "restart" | "getLogs" | undefined;
            serverName?: string | undefined;
            lines?: string | undefined;
        }, {
            commandToRun?: string | undefined;
            commandType?: "start" | "stop" | "restart" | "getLogs" | undefined;
            serverName?: string | undefined;
            lines?: string | undefined;
        }>;
    };
    examples: string[];
}, {
    schema: {
        name: string;
        schema: import("zod").ZodObject<{
            symbolName: import("zod").ZodString;
        }, "strip", import("zod").ZodTypeAny, {
            symbolName: string;
        }, {
            symbolName: string;
        }>;
    };
    examples: string[];
}, {
    schema: {
        name: string;
        schema: import("zod").ZodObject<{
            path: import("zod").ZodString;
            why: import("zod").ZodString;
        }, "strip", import("zod").ZodTypeAny, {
            path: string;
            why: string;
        }, {
            path: string;
            why: string;
        }>;
    };
    examples: string[];
}, {
    schema: {
        name: string;
        schema: import("zod").ZodObject<{
            path: import("zod").ZodString;
            mode: import("zod").ZodEffects<import("zod").ZodEnum<["edit", "whole_write", "rollback"]>, "edit" | "whole_write" | "rollback", unknown>;
            commit_message: import("zod").ZodOptional<import("zod").ZodString>;
            kodu_content: import("zod").ZodOptional<import("zod").ZodString>;
            kodu_diff: import("zod").ZodOptional<import("zod").ZodString>;
        }, "strip", import("zod").ZodTypeAny, {
            path: string;
            mode: "edit" | "whole_write" | "rollback";
            kodu_diff?: string | undefined;
            kodu_content?: string | undefined;
            commit_message?: string | undefined;
        }, {
            path: string;
            kodu_diff?: string | undefined;
            kodu_content?: string | undefined;
            mode?: unknown;
            commit_message?: string | undefined;
        }>;
    };
    examples: string[];
}, {
    schema: {
        name: "spawn_agent";
        schema: import("zod").ZodObject<{
            agentName: import("zod").ZodEnum<["coder", "planner", "sub_task"]>;
            instructions: import("zod").ZodString;
            files: import("zod").ZodOptional<import("zod").ZodString>;
        }, "strip", import("zod").ZodTypeAny, {
            agentName: "coder" | "planner" | "sub_task";
            instructions: string;
            files?: string | undefined;
        }, {
            agentName: "coder" | "planner" | "sub_task";
            instructions: string;
            files?: string | undefined;
        }>;
    };
    examples: string[];
}, {
    schema: {
        name: "exit_agent";
        schema: import("zod").ZodObject<{
            result: import("zod").ZodString;
        }, "strip", import("zod").ZodTypeAny, {
            result: string;
        }, {
            result: string;
        }>;
    };
    examples: string[];
}];
export type Tool = (typeof tools)[number];
export { executeCommandTool, listFilesTool, ExploreRepoFolderTool, searchFilesTool, readFileTool, writeToFileTool, askFollowupQuestionTool, attemptCompletionTool, webSearchTool, urlScreenshotTool, searchSymbolTool as searchSymbolsTool, addInterestedFileTool, fileEditorTool, spawnAgentTool as subAgentTool, exitAgentTool as exitSubAgentTool, };
