import { ToolResponseV2 } from "../../types";
import { BaseAgentTool } from "../base-agent.tool";
import { UrlScreenshotToolParams } from "../schema/url_screenshot";
export declare class UrlScreenshotTool extends BaseAgentTool<UrlScreenshotToolParams> {
    private abortController;
    private isAborting;
    abortToolExecution(): Promise<{
        didAbort: boolean;
    }>;
    execute(): Promise<ToolResponseV2>;
    private executeWithConfirmation;
    private cleanup;
    private onBadInputReceived;
    private askToolExecConfirmation;
    private onExecDenied;
}
