/**
 * @fileoverview Centralny punkt rejestrowania komend rozszerzenia
 * Eksportuje funkcje do rejestracji wszystkich komend rozszerzenia.
 */

import * as vscode from 'vscode';
import { registerRooModeCommands } from './roo-mode-commands';
import { ExtensionProvider } from '../providers/extension-provider';
import { extensionName } from '../shared/constants';

/**
 * Rejestruje wszystkie komendy rozszerzenia
 * @param context Kontekst rozszerzenia VSCode
 * @param provider Dostawca rozszerzenia
 * @returns Lista zarejestrowanych subskrypcji
 */
export function registerCommands(
  context: vscode.ExtensionContext,
  provider: ExtensionProvider
): vscode.Disposable[] {
  const subscriptions: vscode.Disposable[] = [];
  
  // Rejestracja komend trybów Roo
  subscriptions.push(...registerRooModeCommands(context, provider));
  
  // Rejestracja głównego polecenia przełącznika trybów Roo
  subscriptions.push(
    vscode.commands.registerCommand(`${extensionName}.switchRooMode`, () => {
      vscode.commands.executeCommand(`${extensionName}.rooModeList`);
    })
  );
  
  // Tutaj można dodać więcej komend
  
  return subscriptions;
}
