import * as vscode from 'vscode';
import { ShadowBillingManager } from '../api/shadow-billing';

export function registerViewShadowBillingStatsCommand(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand('kodu.viewShadowBillingStats', () => {
        const shadowBillingManager = ShadowBillingManager.getInstance();
        const history = shadowBillingManager.getBillingHistory();
        
        if (history.length === 0) {
            vscode.window.showInformationMessage('No shadow billing data available yet');
            return;
        }

        // Create and show webview
        const panel = vscode.window.createWebviewPanel(
            'shadowBillingStats',
            'Shadow Billing Statistics',
            vscode.ViewColumn.One,
            {}
        );

        // Calculate statistics
        const totalActualCost = history.reduce((sum, item) => sum + item.actualCost, 0);
        const totalShadowCost = history.reduce((sum, item) => sum + item.shadowCost, 0);
        const totalInputTokens = history.reduce((sum, item) => sum + item.inputTokens, 0);
        const totalOutputTokens = history.reduce((sum, item) => sum + item.outputTokens, 0);
        const totalCacheCreationTokens = history.reduce((sum, item) => sum + item.cacheCreationInputTokens, 0);
        const totalCacheReadTokens = history.reduce((sum, item) => sum + item.cacheReadInputTokens, 0);

        // Generate HTML content
        panel.webview.html = `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Shadow Billing Statistics</title>
            <style>
                body {
                    padding: 20px;
                    font-family: var(--vscode-font-family);
                    color: var(--vscode-editor-foreground);
                }
                .stat-card {
                    background-color: var(--vscode-editor-background);
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 4px;
                    padding: 15px;
                    margin-bottom: 15px;
                }
                .stat-title {
                    font-size: 1.2em;
                    margin-bottom: 10px;
                    color: var(--vscode-editor-foreground);
                }
                .stat-value {
                    font-size: 1.5em;
                    color: var(--vscode-textLink-foreground);
                }
                .cost-comparison {
                    display: flex;
                    gap: 20px;
                    margin-bottom: 20px;
                }
                .token-stats {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 15px;
                }
            </style>
        </head>
        <body>
            <h1>Shadow Billing Statistics</h1>
            
            <div class="cost-comparison">
                <div class="stat-card">
                    <div class="stat-title">Actual Cost (if charged)</div>
                    <div class="stat-value">$${totalActualCost.toFixed(4)}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-title">Shadow Cost (tracked)</div>
                    <div class="stat-value">$${totalShadowCost.toFixed(4)}</div>
                </div>
            </div>

            <div class="token-stats">
                <div class="stat-card">
                    <div class="stat-title">Input Tokens</div>
                    <div class="stat-value">${totalInputTokens.toLocaleString()}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-title">Output Tokens</div>
                    <div class="stat-value">${totalOutputTokens.toLocaleString()}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-title">Cache Creation Tokens</div>
                    <div class="stat-value">${totalCacheCreationTokens.toLocaleString()}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-title">Cache Read Tokens</div>
                    <div class="stat-value">${totalCacheReadTokens.toLocaleString()}</div>
                </div>
            </div>

            <div class="stat-card" style="margin-top: 20px;">
                <div class="stat-title">Total API Calls</div>
                <div class="stat-value">${history.length}</div>
            </div>
        </body>
        </html>`;
    });

    context.subscriptions.push(disposable);
}