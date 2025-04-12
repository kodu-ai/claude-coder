/**
 * @fileoverview Menedżer narzędzi dla integracji Claude Coder z interfejsem Roo
 * Zapewnia API do rejestrowania, wykonywania i zarządzania narzędziami w formacie Roo.
 */

import { ToolExecutor } from "./tool-executor";
import { RooToolAdapter } from "./adapters/roo-tool-adapter";
import { RooXmlParser } from "./tool-parser/roo-xml-parser";
import { ToolResponseV2 } from "../types";
import { AgentToolOptions } from "./types";

/**
 * Klasa zarządzająca narzędziami Roo
 * Umożliwia konwersję i wykonywanie narzędzi Roo przy użyciu narzędzi Claude Coder
 */
export class RooToolsManager {
  /** Adapter do konwersji narzędzi Roo na narzędzia Claude Coder */
  private readonly rooAdapter: RooToolAdapter;
  /** Parser XML dla poleceń narzędzi Roo */
  private readonly xmlParser: RooXmlParser;
  /** Wykonawca narzędzi Claude Coder */
  private readonly toolExecutor: ToolExecutor;
  /** Słuchacze zdarzeń narzędzi */
  private readonly listeners: Array<(toolName: string, result: ToolResponseV2) => void> = [];

  /**
   * Konstruktor klasy RooToolsManager
   * @param options Opcje dla narzędzi
   */
  constructor(options: AgentToolOptions) {
    this.rooAdapter = new RooToolAdapter();
    this.toolExecutor = new ToolExecutor(options);
    
    // Inicjalizacja parsera XML z callbackami
    this.xmlParser = new RooXmlParser({
      onToolEnd: (toolName, params) => {
        this.handleToolEnd(toolName, params);
      },
      onError: (error) => {
        console.error("Błąd parsowania XML Roo:", error);
      }
    });
  }

  /**
   * Obsługuje zakończenie tagu narzędzia Roo
   * @param toolName Nazwa narzędzia Roo
   * @param params Parametry narzędzia Roo
   */
  private async handleToolEnd(toolName: string, params: Record<string, string>): Promise<void> {
    try {
      // Konwertuj polecenie Roo na format Claude Coder
      const xmlString = this.buildXmlString(toolName, params);
      const { name, params: claudeParams } = this.rooAdapter.parseRooToolXml(xmlString);
      
      // Wykonaj narzędzie Claude Coder
      const result = await this.toolExecutor.processToolUse(`<${name}>${JSON.stringify(claudeParams)}</${name}>`);
      
      // Poczekaj na zakończenie wszystkich narzędzi
      await this.toolExecutor.waitForToolProcessing();
      
      // Pobierz wyniki narzędzi
      const toolResults = this.toolExecutor.getToolResults();
      if (toolResults.length > 0) {
        const lastResult = toolResults[toolResults.length - 1];
        // Powiadom słuchaczy o wyniku
        this.notifyListeners(toolName, lastResult.result);
      }
    } catch (error) {
      console.error(`Błąd wykonania narzędzia Roo ${toolName}:`, error);
      // Stwórz obiekt błędu dla słuchaczy
      const errorResponse: ToolResponseV2 = {
        toolName: toolName as any as ToolName,
        toolId: `roo-${toolName}-${Date.now()}`,
        status: "error",
        text: error instanceof Error ? error.message : String(error)
      };
      this.notifyListeners(toolName, errorResponse);
    }
  }

  /**
   * Buduje ciąg XML dla narzędzia Roo
   * @param toolName Nazwa narzędzia Roo
   * @param params Parametry narzędzia Roo
   * @returns Ciąg XML reprezentujący narzędzie Roo i jego parametry
   */
  private buildXmlString(toolName: string, params: Record<string, string>): string {
    let xml = `<${toolName}>`;
    
    // Dodaj parametry
    for (const [paramName, paramValue] of Object.entries(params)) {
      xml += `<${paramName}>${paramValue}</${paramName}>`;
    }
    
    xml += `</${toolName}>`;
    return xml;
  }

  /**
   * Powiadamia słuchaczy o wyniku narzędzia
   * @param toolName Nazwa narzędzia Roo
   * @param result Wynik narzędzia
   */
  private notifyListeners(toolName: string, result: ToolResponseV2): void {
    for (const listener of this.listeners) {
      try {
        listener(toolName, result);
      } catch (error) {
        console.error("Błąd w słuchaczu narzędzia:", error);
      }
    }
  }

  /**
   * Przetwarza wejście XML w formacie Roo
   * @param input Tekst zawierający polecenia XML w formacie Roo
   * @returns Zmodyfikowany tekst z usuniętymi poleceniami XML
   */
  public async processInput(input: string): Promise<string> {
    // Parsuj tekst w poszukiwaniu poleceń XML
    this.xmlParser.parse(input);
    return input;
  }

  /**
   * Dodaje słuchacza zdarzeń narzędzi
   * @param listener Funkcja słuchacza wywoływana po zakończeniu narzędzia
   */
  public addToolListener(listener: (toolName: string, result: ToolResponseV2) => void): void {
    this.listeners.push(listener);
  }

  /**
   * Usuwa słuchacza zdarzeń narzędzi
   * @param listener Funkcja słuchacza do usunięcia
   */
  public removeToolListener(listener: (toolName: string, result: ToolResponseV2) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index !== -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Pobiera definicje narzędzi Roo
   * @returns Ciąg JSON zawierający definicje narzędzi Roo
   */
  public getToolDefinitions(): string {
    const definitions = this.rooAdapter.generateRooToolDefinitions();
    return JSON.stringify(definitions, null, 2);
  }

  /**
   * Przerywa wykonanie wszystkich narzędzi
   */
  public async abortAllTools(): Promise<void> {
    await this.toolExecutor.abortTask();
  }

  /**
   * Resetuje stan menedżera narzędzi
   */
  public async reset(): Promise<void> {
    this.xmlParser.resetParseState();
    await this.toolExecutor.resetToolState();
  }

  /**
   * Sprawdza, czy jakiekolwiek narzędzia są aktywne
   * @returns True, jeśli jakiekolwiek narzędzia są aktywne
   */
  public hasActiveTools(): boolean {
    return this.toolExecutor.hasActiveTools();
  }
}
