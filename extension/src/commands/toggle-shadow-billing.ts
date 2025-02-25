import * as vscode from 'vscode';
import { ShadowBillingManager } from '../api/shadow-billing';

// Event emitter for shadow billing state changes
export const shadowBillingStateEmitter = new vscode.EventEmitter<boolean>();

export function registerToggleShadowBillingCommand(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand('kodu.toggleShadowBilling', () => {
        const shadowBillingManager = ShadowBillingManager.getInstance();
        const isEnabled = shadowBillingManager.isShadowModeEnabled();

        if (isEnabled) {
            shadowBillingManager.disableShadowMode();
            vscode.window.showInformationMessage('Shadow Billing disabled - API calls will now be charged');
        } else {
            shadowBillingManager.enableShadowMode();
            vscode.window.showInformationMessage('Shadow Billing enabled - API calls will be tracked but not charged');
        }

        // Emit state change event
        shadowBillingStateEmitter.fire(!isEnabled);
    });

    context.subscriptions.push(disposable);
    context.subscriptions.push(shadowBillingStateEmitter);
}