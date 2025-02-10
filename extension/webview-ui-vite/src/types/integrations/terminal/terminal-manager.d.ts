import { EventEmitter } from "events";
import * as vscode from "vscode";
declare module "vscode" {
    interface Terminal {
        shellIntegration?: {
            cwd?: vscode.Uri;
            executeCommand?: (command: string) => {
                read: () => AsyncIterable<string>;
            };
        };
    }
    interface Window {
        onDidStartTerminalShellExecution?: (listener: (e: any) => any, thisArgs?: any, disposables?: vscode.Disposable[]) => vscode.Disposable;
    }
}
export interface TerminalInfo {
    terminal: vscode.Terminal;
    busy: boolean;
    lastCommand: string;
    id: number;
    name?: string;
}
export interface DevServerInfo {
    terminalInfo: TerminalInfo;
    url: string | null;
    logs: string[];
    status: "starting" | "running" | "stopped" | "error";
    error?: string;
}
export declare class TerminalRegistry {
    private static terminals;
    private static nextTerminalId;
    private static devServers;
    private static terminalOutputMap;
    private static outputBuffers;
    static createTerminal(cwd?: string | vscode.Uri | undefined, name?: string): TerminalInfo;
    static addOutput(terminalId: number, output: string, flush?: boolean): void;
    static getTerminal(id: number): TerminalInfo | undefined;
    static getTerminalByName(name: string): TerminalInfo | undefined;
    /**
     * Closes the terminal with the given ID.
     * @param id The unique ID of the terminal to close.
     * @returns True if the terminal was found and closed, false otherwise.
     */
    static closeTerminal(id: number): boolean;
    static updateTerminal(id: number, updates: Partial<TerminalInfo>): void;
    static removeTerminal(id: number): void;
    static getAllTerminals(): TerminalInfo[];
    private static isTerminalClosed;
    static addDevServer(terminalInfo: TerminalInfo, url?: string | null): void;
    static updateDevServerUrl(terminalId: number, url: string): void;
    static updateDevServerStatus(terminalId: number, status: DevServerInfo["status"], error?: string): void;
    static getDevServer(terminalId: number): DevServerInfo | undefined;
    static getDevServerByName(name: string): DevServerInfo | undefined;
    static getAllDevServers(): DevServerInfo[];
    static isDevServerRunning(terminalId: number): boolean;
    static isDevServerRunningByName(name: string): boolean;
    static removeDevServer(terminalId: number): void;
    static clearDevServer(terminalId: number): void;
    static clearAllDevServers(): void;
    static getTerminalLogs(terminalId: number): string[];
    static flushOutputBuffer(terminalId: number): void;
}
export declare class TerminalManager {
    private terminalIds;
    private processes;
    private disposables;
    constructor();
    runCommand(terminalInfo: TerminalInfo, command: string, options?: {
        autoClose?: boolean;
    }): TerminalProcessResultPromise;
    getOrCreateTerminal(cwd: string, name?: string): Promise<TerminalInfo>;
    getTerminals(busy: boolean): {
        id: number;
        name?: string;
        lastCommand: string;
    }[];
    isProcessHot(terminalId: number): boolean;
    /**
     * Closes the terminal with the given ID.
     * @param id The unique ID of the terminal to close.
     * @returns True if the terminal was found and closed, false otherwise.
     */
    closeTerminal(id: number): boolean;
    /**
     * Closes all managed terminals.
     */
    closeAllTerminals(): void;
    disposeAll(): void;
}
interface TerminalProcessEvents {
    line: [line: string];
    continue: [];
    completed: [];
    error: [error: Error];
    no_shell_integration: [];
}
export declare class TerminalProcess extends EventEmitter<TerminalProcessEvents> {
    waitForShellIntegration: boolean;
    private isListening;
    private buffer;
    private fullOutput;
    private lastRetrievedLineIndex;
    isHot: boolean;
    private outputQueue;
    private processingOutput;
    private hotTimer;
    run(terminal: vscode.Terminal, command: string, terminalId: number): Promise<void>;
    private queueOutput;
    private processOutputQueue;
    private emitIfEol;
    private emitRemainingBufferIfListening;
}
export type TerminalProcessResultPromise = TerminalProcess & Promise<void>;
export declare function mergePromise(process: TerminalProcess, promise: Promise<void>): TerminalProcessResultPromise;
export {};
