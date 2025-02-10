import { ClaudeAsk } from "../../../shared/messages/extension-message";
import { ClaudeAskResponse } from "../../../shared/messages/client-message";
import { AskDetails, AskResponse } from "./utils";
import { StateManager } from "../state-manager";
export declare class AskManager {
    private readonly stateManager;
    private readonly webViewManager;
    private currentAsk;
    private currentAskId;
    private pendingToolAsks;
    constructor(stateManager: StateManager);
    abortPendingAsks(): Promise<void>;
    ask(type: ClaudeAsk, data?: AskDetails, askTs?: number, disableAutoApprove?: boolean): Promise<AskResponse>;
    handleResponse(id: number, response: ClaudeAskResponse, text?: string, images?: string[]): void;
    dispose(): void;
    private trackToolAsk;
    private handleExistingAskUpdate;
    private handleNewAsk;
    private createAskMessage;
    private updateState;
    private shouldAutoApprove;
    private isToolAsk;
    private isExistingAskUpdate;
    private isCurrentAsk;
    private isToolAskResponse;
    private resolveCurrentAsk;
    hasActiveAsk(): boolean;
    private resolveToolAsk;
}
