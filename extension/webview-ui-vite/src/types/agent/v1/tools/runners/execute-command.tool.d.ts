import { BaseAgentTool } from "../base-agent.tool";
import { ToolResponseV2 } from "../../types";
import { ExecuteCommandToolParams } from "../schema/execute_command";
export declare const shellIntegrationErrorOutput: string;
export declare class ExecuteCommandTool extends BaseAgentTool<ExecuteCommandToolParams> {
    private output;
    execute(): Promise<ToolResponseV2>;
    private isApprovedState;
    private executeShellTerminal;
}
