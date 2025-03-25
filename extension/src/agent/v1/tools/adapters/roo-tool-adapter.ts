/**
 * @fileoverview Adapter do integracji narzędzi Claude Coder z interfejsem Roo Code
 * Umożliwia konwersję poleceń narzędzi z formatu XML używanego w Roo Code do formatu
 * używanego przez Claude Coder, a także konwersję wyników narzędzi Claude Coder na format
 * oczekiwany przez Roo Code.
 */

import type { ToolResponseV2 } from "../../types";
import type { ToolName } from "../types";
import type { BaseAgentTool } from "../base-agent.tool";

/**
 * Interfejs opisujący narzędzie Roo
 */
interface RooTool {
  name: string;
  description: string;
  parameters: RooToolParameters;
}

/**
 * Interfejs opisujący parametry narzędzia Roo
 */
interface RooToolParameters {
  properties: Record<string, RooToolProperty>;
  required: string[];
  type: string;
}

/**
 * Interfejs opisujący właściwość parametru narzędzia Roo
 */
interface RooToolProperty {
  description: string;
  type: string;
  enum?: string[];
  items?: {
    type: string;
  };
}

/**
 * Klasa adaptera narzędzi Roo
 * Umożliwia konwersję poleceń narzędzi z formatu Roo do formatu Claude Coder
 */
export class RooToolAdapter {
  /**
   * Mapa konwersji nazw narzędzi z formatu Roo do formatu Claude Coder
   */
  private static readonly toolNameMapping: Record<string, ToolName> = {
    'read_file': 'read_file',
    'search_files': 'search_files',
    'list_files': 'list_files',
    'execute_command': 'execute_command',
    'apply_diff': 'file_editor',
    'write_to_file': 'file_editor',
    'list_code_definition_names': 'search_symbol',
    'ask_followup_question': 'ask_followup_question',
    'attempt_completion': 'attempt_completion'
  };

  /**
   * Konstruktor klasy RooToolAdapter
   */
  constructor() {}

  /**
   * Konwertuje polecenie narzędzia Roo na format Claude Coder
   * @param toolXml XML zawierający polecenie narzędzia Roo
   * @returns Obiekt zawierający parametry dla narzędzia Claude Coder
   */
  public parseRooToolXml(toolXml: string): { name: ToolName; params: any } {
    // Wyciągnij nazwę narzędzia z tagu XML
    const toolNameMatch = toolXml.match(/<([a-zA-Z_]+)>/);
    if (!toolNameMatch || toolNameMatch.length < 2) {
      throw new Error('Nie znaleziono nazwy narzędzia w XML');
    }

    const rooToolName = toolNameMatch[1];
    const toolName = RooToolAdapter.toolNameMapping[rooToolName];

    if (!toolName) {
      throw new Error(`Nieznane narzędzie Roo: ${rooToolName}`);
    }

    // Wyciągnij parametry narzędzia
    const params: Record<string, any> = {};
    
    // Znajdź wszystkie tagi parametrów
    const paramMatches = [...toolXml.matchAll(/<([a-zA-Z_]+)>([\s\S]*?)<\/\1>/g)];
    
    for (const match of paramMatches) {
      const [, paramName, paramValue] = match;
      if (paramName !== rooToolName) {
        params[paramName] = paramValue.trim();
      }
    }

    // Przekształć parametry zgodnie z mapowaniem narzędzi
    const transformedParams = this.transformParameters(toolName, params);

    return { name: toolName, params: transformedParams };
  }

  /**
   * Konwertuje parametry z formatu Roo na format Claude Coder
   * @param toolName Nazwa narzędzia Claude Coder
   * @param params Parametry w formacie Roo
   * @returns Parametry w formacie Claude Coder
   */
  private transformParameters(toolName: ToolName, params: Record<string, any>): any {
    switch (toolName) {
      case 'read_file':
        return {
          path: params.path,
          start_line: params.start_line ? parseInt(params.start_line) : undefined,
          end_line: params.end_line ? parseInt(params.end_line) : undefined,
          auto_truncate: params.auto_truncate === 'true'
        };
      
      case 'list_files':
        return {
          path: params.path,
          recursive: params.recursive === 'true'
        };
      
      case 'search_files':
        return {
          path: params.path,
          regex: params.regex,
          file_pattern: params.file_pattern
        };
      
      case 'execute_command':
        return {
          command: params.command,
          cwd: params.cwd
        };
      
      case 'file_editor':
        // Obsługa apply_diff i write_to_file
        if (params.diff) {
          return {
            path: params.path,
            kodu_diff: params.diff
          };
        } else if (params.content) {
          return {
            path: params.path,
            kodu_content: params.content,
            line_count: params.line_count ? parseInt(params.line_count) : undefined
          };
        }
        break;
      
      case 'search_symbol':
        return {
          path: params.path
        };
      
      case 'ask_followup_question':
        return {
          question: params.question,
          follow_up: params.follow_up
        };
      
      case 'attempt_completion':
        return {
          result: params.result,
          command: params.command
        };
      
      default:
        return params;
    }
  }

  /**
   * Konwertuje wynik narzędzia Claude Coder na format Roo
   * @param toolResult Wynik narzędzia Claude Coder
   * @returns Sformatowany wynik dla Roo
   */
  public formatToolResultForRoo(toolResult: ToolResponseV2): string {
    const { toolName, text, status } = toolResult;

    // Znajdź odpowiednią nazwę narzędzia Roo
    const rooToolName = Object.entries(RooToolAdapter.toolNameMapping)
      .find(([_, claudeToolName]) => claudeToolName === toolName)?.[0];

    if (!rooToolName) {
      return `Błąd: nieznane narzędzie ${toolName}`;
    }

    if (status === 'error') {
      return `Błąd wykonania narzędzia ${rooToolName}: ${text}`;
    }

    return text ?? "";
  }

  /**
   * Generuje definicje narzędzi Roo na podstawie narzędzi Claude Coder
   * @returns Tablica definicji narzędzi w formacie Roo
   */
  public generateRooToolDefinitions(): RooTool[] {
    const tools: RooTool[] = [
      {
        name: "read_file",
        description: "Odczytuje zawartość pliku z określonej ścieżki.",
        parameters: {
          properties: {
            path: {
              description: "Ścieżka do pliku (względem bieżącego katalogu roboczego)",
              type: "string"
            },
            start_line: {
              description: "Linia początkowa (opcjonalne)",
              type: "string"
            },
            end_line: {
              description: "Linia końcowa (opcjonalne)",
              type: "string"
            },
            auto_truncate: {
              description: "Czy automatycznie przycinać duże pliki (opcjonalne)",
              type: "string"
            }
          },
          required: ["path"],
          type: "object"
        }
      },
      {
        name: "list_files",
        description: "Wyświetla pliki i katalogi w określonym katalogu.",
        parameters: {
          properties: {
            path: {
              description: "Ścieżka do katalogu (względem bieżącego katalogu roboczego)",
              type: "string"
            },
            recursive: {
              description: "Czy wyświetlać pliki rekurencyjnie (true/false, opcjonalne)",
              type: "string"
            }
          },
          required: ["path"],
          type: "object"
        }
      },
      {
        name: "search_files",
        description: "Wyszukuje pliki zawierające określony wzorzec.",
        parameters: {
          properties: {
            path: {
              description: "Ścieżka do katalogu do przeszukania (względem bieżącego katalogu roboczego)",
              type: "string"
            },
            regex: {
              description: "Wyrażenie regularne do wyszukania",
              type: "string"
            },
            file_pattern: {
              description: "Wzorzec filtrowania plików (np. '*.ts') (opcjonalne)",
              type: "string"
            }
          },
          required: ["path", "regex"],
          type: "object"
        }
      },
      {
        name: "execute_command",
        description: "Wykonuje polecenie w powłoce systemowej.",
        parameters: {
          properties: {
            command: {
              description: "Polecenie do wykonania",
              type: "string"
            },
            cwd: {
              description: "Katalog roboczy do wykonania polecenia (opcjonalne)",
              type: "string"
            }
          },
          required: ["command"],
          type: "object"
        }
      },
      {
        name: "write_to_file",
        description: "Zapisuje zawartość do pliku.",
        parameters: {
          properties: {
            path: {
              description: "Ścieżka do pliku (względem bieżącego katalogu roboczego)",
              type: "string"
            },
            content: {
              description: "Zawartość do zapisania",
              type: "string"
            },
            line_count: {
              description: "Liczba linii w pliku",
              type: "string"
            }
          },
          required: ["path", "content", "line_count"],
          type: "object"
        }
      },
      {
        name: "apply_diff",
        description: "Zastępuje istniejący kod za pomocą bloku wyszukiwania i zamiany.",
        parameters: {
          properties: {
            path: {
              description: "Ścieżka do pliku (względem bieżącego katalogu roboczego)",
              type: "string"
            },
            diff: {
              description: "Blok wyszukiwania/zamiany definiujący zmiany",
              type: "string"
            }
          },
          required: ["path", "diff"],
          type: "object"
        }
      },
      {
        name: "list_code_definition_names",
        description: "Wyświetla nazwy definicji (klasy, funkcje, metody itp.) w kodzie źródłowym.",
        parameters: {
          properties: {
            path: {
              description: "Ścieżka do katalogu (względem bieżącego katalogu roboczego)",
              type: "string"
            }
          },
          required: ["path"],
          type: "object"
        }
      },
      {
        name: "ask_followup_question",
        description: "Zadaje użytkownikowi pytanie w celu zebrania dodatkowych informacji.",
        parameters: {
          properties: {
            question: {
              description: "Pytanie do zadania użytkownikowi",
              type: "string"
            },
            follow_up: {
              description: "Lista 2-4 sugerowanych odpowiedzi",
              type: "string"
            }
          },
          required: ["question", "follow_up"],
          type: "object"
        }
      },
      {
        name: "attempt_completion",
        description: "Prezentuje wynik zadania użytkownikowi.",
        parameters: {
          properties: {
            result: {
              description: "Wynik zadania",
              type: "string"
            },
            command: {
              description: "Polecenie do demonstracji wyniku (opcjonalne)",
              type: "string"
            }
          },
          required: ["result"],
          type: "object"
        }
      }
    ];

    return tools;
  }
}
