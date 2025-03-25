/**
 * @fileoverview Integracja z interfejsem Roo Code dla Claude Coder
 * Dostarcza API do inicjalizacji i korzystania z narzędzi Claude Coder
 * w formacie kompatybilnym z Roo Code.
 */

import * as vscode from "vscode";
import { RooToolsManager } from "../../agent/v1/tools/roo-tools-manager";
import { MainAgent } from "../../agent/v1/main-agent";

/**
 * Klasa integracyjna dla Roo Code
 * Umożliwia inicjalizację, zarządzanie i używanie narzędzi Claude Coder
 * w formacie Roo Code
 */
export class RooIntegration {
  /** Instancja menedżera narzędzi Roo */
  private rooToolsManager: RooToolsManager | null = null;
  /** Kanał wyjściowy do logowania informacji o integracji */
  private readonly outputChannel: vscode.OutputChannel;
  /** Bieżący kontekst rozszerzenia */
  private readonly context: vscode.ExtensionContext;
  /** Ścieżka bieżącego katalogu roboczego */
  private readonly cwd: string;
  /** Instancja głównego agenta Claude */
  private readonly koduDev: MainAgent;

  /**
   * Konstruktor klasy RooIntegration
   * @param context Kontekst rozszerzenia VSCode
   * @param outputChannel Kanał wyjściowy do logowania
   * @param koduDev Instancja głównego agenta Claude
   */
  constructor(context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel, koduDev: MainAgent) {
    this.context = context;
    this.outputChannel = outputChannel;
    this.koduDev = koduDev;
    
    // Ustal katalog roboczy
    this.cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || context.extensionPath;
    
    // Zarejestruj komendy
    this.registerCommands();
  }

  /**
   * Rejestruje komendy związane z integracją Roo
   */
  private registerCommands(): void {
    // Komenda inicjalizacji integracji Roo
    this.context.subscriptions.push(
      vscode.commands.registerCommand("claudeCoder.initRooIntegration", () => this.initialize())
    );
    
    // Komenda przetwarzania komendy Roo
    this.context.subscriptions.push(
      vscode.commands.registerCommand("claudeCoder.processRooCommand", 
        (command: string) => this.processCommand(command))
    );
    
    // Komenda czyszczenia stanu Roo
    this.context.subscriptions.push(
      vscode.commands.registerCommand("claudeCoder.resetRooState", 
        () => this.resetState())
    );
  }

  /**
   * Inicjalizuje integrację Roo
   * @returns Instancja menedżera narzędzi Roo lub null w przypadku błędu
   */
  public async initialize(): Promise<RooToolsManager | null> {
    try {
      this.outputChannel.appendLine("Inicjalizacja integracji Roo...");
      
      // Inicjalizuj menedżer narzędzi Roo
      this.rooToolsManager = new RooToolsManager({
        cwd: this.cwd,
        koduDev: this.koduDev,
        alwaysAllowReadOnly: true,
        alwaysAllowWriteOnly: false,
        setRunningProcessId: (pid) => {
          // Zapisz ID procesu do ewentualnego przerwania
          this.context.workspaceState.update("rooRunningProcessId", pid);
        }
      });
      
      // Dodaj słuchacza wyników narzędzi
      this.rooToolsManager.addToolListener((toolName, result) => {
        this.handleToolResult(toolName, result);
      });
      
      // Wyświetl powiadomienie o powodzeniu
      vscode.window.showInformationMessage("Integracja z Roo Code została zainicjalizowana");
      
      // Zapisz referencję do menedżera w kontekście rozszerzenia
      this.context.workspaceState.update("rooToolsManager", this.rooToolsManager);
      
      return this.rooToolsManager;
    } catch (error) {
      this.outputChannel.appendLine(`Błąd inicjalizacji integracji Roo: ${error}`);
      vscode.window.showErrorMessage("Nie udało się zainicjalizować integracji z Roo Code");
      return null;
    }
  }

  /**
   * Przetwarza komendę Roo
   * @param command Komenda Roo w formacie XML
   * @returns Wynik przetwarzania komendy
   */
  public async processCommand(command: string): Promise<string> {
    if (!this.rooToolsManager) {
      const error = "Integracja Roo nie została zainicjalizowana. Uruchom komendę claudeCoder.initRooIntegration";
      this.outputChannel.appendLine(error);
      vscode.window.showErrorMessage(error);
      return error;
    }
    
    try {
      this.outputChannel.appendLine(`Przetwarzanie komendy Roo: ${command}`);
      const result = await this.rooToolsManager.processInput(command);
      return result;
    } catch (error) {
      const errorMessage = `Błąd przetwarzania komendy Roo: ${error}`;
      this.outputChannel.appendLine(errorMessage);
      return errorMessage;
    }
  }

  /**
   * Obsługuje wynik wykonania narzędzia
   * @param toolName Nazwa narzędzia
   * @param result Wynik wykonania narzędzia
   */
  private handleToolResult(toolName: string, result: any): void {
    this.outputChannel.appendLine(`Wynik narzędzia ${toolName}:`);
    this.outputChannel.appendLine(JSON.stringify(result, null, 2));
    
    // Możesz tutaj dodać dodatkową logikę obsługi wyniku
    // np. wyświetlenie powiadomienia, aktualizację UI, itp.
  }

  /**
   * Resetuje stan integracji Roo
   */
  public async resetState(): Promise<void> {
    if (this.rooToolsManager) {
      await this.rooToolsManager.reset();
      this.outputChannel.appendLine("Stan integracji Roo został zresetowany");
    }
  }

  /**
   * Przerywa wykonanie wszystkich narzędzi Roo
   */
  public async abortAllTools(): Promise<void> {
    if (this.rooToolsManager) {
      await this.rooToolsManager.abortAllTools();
      this.outputChannel.appendLine("Wszystkie narzędzia Roo zostały przerwane");
    }
  }

  /**
   * Pobiera definicje dostępnych narzędzi Roo
   * @returns Definicje narzędzi w formie JSON lub null
   */
  public getToolDefinitions(): string | null {
    if (!this.rooToolsManager) {
      return null;
    }
    
    return this.rooToolsManager.getToolDefinitions();
  }
}
