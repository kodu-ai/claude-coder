import { ExtensionProvider } from "../../../providers/extension-provider";
import { KoduAgentState, ClaudeMessage } from "../types";
import { IOManager } from "./io-manager";
import { StateManager } from ".";
interface ClaudeMessagesManagerOptions {
    state: KoduAgentState;
    ioManager: IOManager;
    providerRef: WeakRef<ExtensionProvider>;
    stateManager: StateManager;
}
export type OverwriteClaudeMessagesOptions = {
    updateTs?: boolean;
    updateIsDone?: boolean;
};
export declare class ClaudeMessagesManager {
    private stateManager;
    private state;
    private ioManager;
    private providerRef;
    constructor(options: ClaudeMessagesManagerOptions);
    getSavedClaudeMessages(): Promise<ClaudeMessage[]>;
    saveClaudeMessages(updateTs?: boolean, updateIsDone?: boolean): Promise<ClaudeMessage[]>;
    deleteClaudeMessage(messageId: number, withFlush?: boolean): Promise<import("../../../shared/messages/extension-message").V1ClaudeMessage[] | undefined>;
    getMessageById(messageId: number): ClaudeMessage | undefined;
    addToClaudeMessages(message: ClaudeMessage, withFlush?: boolean): Promise<import("../../../shared/messages/extension-message").V1ClaudeMessage>;
    overwriteClaudeMessages(newMessages: ClaudeMessage[], options?: OverwriteClaudeMessagesOptions, withFlush?: boolean): Promise<import("../../../shared/messages/extension-message").V1ClaudeMessage[]>;
    removeEverythingAfterMessage(messageId: number, withFlush?: boolean): Promise<import("../../../shared/messages/extension-message").V1ClaudeMessage[] | undefined>;
    updateClaudeMessage(messageId: number, message: ClaudeMessage, withFlush?: boolean): Promise<import("../../../shared/messages/extension-message").V1ClaudeMessage | undefined>;
    appendToClaudeMessage(messageId: number, text: string, withFlush?: boolean): Promise<import("../../../shared/messages/extension-message").V1ClaudeMessage | undefined>;
    addToClaudeAfterMessage(messageId: number, message: ClaudeMessage, withFlush?: boolean): Promise<import("../../../shared/messages/extension-message").V1ClaudeMessage | undefined>;
    private safeProviderRef;
    private safePostMessage;
}
export {};
