import * as vscode from "vscode";
export declare class BrowserManager {
    private browser?;
    private page?;
    private context;
    constructor(context: vscode.ExtensionContext);
    private ensureChromiumExists;
    launchBrowser(): Promise<void>;
    closeBrowser(): Promise<void>;
    urlToScreenshotAndLogs(url: string): Promise<{
        buffer: Buffer;
        logs: string[];
    }>;
}
