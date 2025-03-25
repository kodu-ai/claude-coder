/**
 * @fileoverview Komendy do zarządzania trybami Roo
 * Umożliwia przełączanie między różnymi trybami pracy (Code, Architect, Ask, Debug)
 * oraz dostarcza interfejs do zarządzania ich opcjami.
 */

import * as vscode from 'vscode';
import { RooModeManager, RooMode } from '../agent/v1/modes/roo-mode-manager';
import { ExtensionProvider } from '../providers/extension-provider';
import { extensionName } from '../shared/constants';

/**
 * Tworzy i rejestruje polecenia do obsługi trybów Roo
 * @param context Kontekst rozszerzenia VSCode
 * @param provider Dostawca rozszerzenia
 */
export function registerRooModeCommands(
  context: vscode.ExtensionContext,
  provider: ExtensionProvider
): vscode.Disposable[] {
  const subscriptions: vscode.Disposable[] = [];
  const outputChannel = provider.getOutputChannel();
  const modeManager = provider.rooModeManager;
  
  if (!modeManager) {
    outputChannel.appendLine("Menedżer trybów Roo nie został zainicjalizowany, pomijanie rejestracji poleceń trybów.");
    return subscriptions;
  }

  // Polecenie wyświetlające dostępne tryby
  subscriptions.push(
    vscode.commands.registerCommand(`${extensionName}.rooModeList`, async () => {
      const modes = modeManager.getAllModes();
      const currentMode = modeManager.getCurrentMode();
      
      const items = modes.map(({ mode, options }) => ({
        label: options.name,
        description: options.description,
        detail: mode === currentMode ? "✓ Aktywny" : undefined,
        mode: mode
      }));
      
      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Wybierz tryb Roo',
        title: 'Tryby Claude Coder',
      });
      
      if (selected) {
        try {
          modeManager.switchMode(selected.mode);
          vscode.window.showInformationMessage(`Przełączono na tryb ${selected.label}`);
        } catch (error) {
          vscode.window.showErrorMessage(`Nie udało się przełączyć na tryb ${selected.label}: ${error}`);
        }
      }
    })
  );
  
  // Polecenia przełączania na określone tryby
  const modeSwitchCommands = [
    { command: `${extensionName}.rooModeCode`, mode: RooMode.CODE, name: 'Code' },
    { command: `${extensionName}.rooModeArchitect`, mode: RooMode.ARCHITECT, name: 'Architect' },
    { command: `${extensionName}.rooModeAsk`, mode: RooMode.ASK, name: 'Ask' },
    { command: `${extensionName}.rooModeDebug`, mode: RooMode.DEBUG, name: 'Debug' },
  ];
  
  for (const { command, mode, name } of modeSwitchCommands) {
    subscriptions.push(
      vscode.commands.registerCommand(command, () => {
        try {
          modeManager.switchMode(mode);
          vscode.window.showInformationMessage(`Przełączono na tryb ${name}`);
          
          // Powiadom webview o zmianie trybu
          provider.getWebviewManager().postMessageToWebview({
            type: "action",
            action: "rooModeChanged",
            data: {
              currentMode: mode,
              modeOptions: modeManager.getCurrentModeOptions()
            }
          });
        } catch (error) {
          vscode.window.showErrorMessage(`Nie udało się przełączyć na tryb ${name}: ${error}`);
        }
      })
    );
  }
  
  // Polecenie dostosowywania instrukcji systemowej dla aktualnego trybu
  subscriptions.push(
    vscode.commands.registerCommand(`${extensionName}.rooModeCustomizePrompt`, async () => {
      const currentMode = modeManager.getCurrentMode();
      const modeOptions = modeManager.getCurrentModeOptions();
      
      const document = await vscode.workspace.openTextDocument({
        content: modeOptions.systemPrompt,
        language: 'markdown'
      });
      
      const editor = await vscode.window.showTextDocument(document);
      
      // Listener na zapisanie dokumentu
      const saveListener = vscode.workspace.onDidSaveTextDocument((savedDoc) => {
        if (savedDoc === document) {
          const newPrompt = savedDoc.getText();
          modeManager.updateModeOptions(currentMode, { systemPrompt: newPrompt });
          vscode.window.showInformationMessage(`Zaktualizowano instrukcję systemową dla trybu ${modeOptions.name}`);
        }
      });
      
      // Listener na zamknięcie edytora
      const closeListener = vscode.window.onDidChangeVisibleTextEditors((editors) => {
        if (!editors.some(e => e.document === document)) {
          saveListener.dispose();
          closeListener.dispose();
        }
      });
      
      // Dodaj do subskrypcji
      subscriptions.push(saveListener, closeListener);
    })
  );
  
  return subscriptions;
}
