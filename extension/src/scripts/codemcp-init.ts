/**
 * @fileoverview Skrypt inicjalizacyjny dla codemcp
 * Przygotowuje środowisko Claude Coder do pracy z dowolnymi modelami AI
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { spawn } from 'child_process';
import { extensionName } from '../shared/constants';

/**
 * Konfiguracja inicjalizacji codemcp
 */
interface InitConfig {
  /** Ścieżka do projektu */
  projectPath: string;
  /** Czy użyć automatycznej detekcji modeli */
  autoDetectModels?: boolean;
  /** Lista preferowanych modeli */
  preferredModels?: string[];
}

/**
 * Klasa inicjalizacyjna dla codemcp
 * Przygotowuje środowisko projektu i konfiguruje integrację z różnymi modelami AI
 */
export class CodeMcpInit {
  /** Ścieżka do projektu */
  private readonly projectPath: string;
  /** Kanał wyjściowy do logowania */
  private readonly outputChannel: vscode.OutputChannel;
  /** Konfiguracja inicjalizacji */
  private readonly config: InitConfig;

  /**
   * Konstruktor klasy CodeMcpInit
   * @param config Konfiguracja inicjalizacji
   * @param outputChannel Kanał wyjściowy do logowania
   */
  constructor(config: InitConfig, outputChannel: vscode.OutputChannel) {
    this.config = config;
    this.projectPath = config.projectPath;
    this.outputChannel = outputChannel;
  }

  /**
   * Inicjalizuje projekt dla codemcp
   * @returns Promise<void>
   */
  public async initialize(): Promise<void> {
    try {
      this.outputChannel.show();
      this.outputChannel.appendLine(`Inicjalizacja codemcp dla ścieżki: ${this.projectPath}`);

      // 1. Sprawdź czy ścieżka istnieje
      if (!fs.existsSync(this.projectPath)) {
        throw new Error(`Ścieżka ${this.projectPath} nie istnieje.`);
      }

      // 2. Sprawdź i utwórz strukturę katalogów
      await this.createDirectoryStructure();

      // 3. Inicjalizacja integracji z Roo dla wszystkich modeli
      await this.initializeRooIntegration();

      // 4. Wykryj dostępne modele
      if (this.config.autoDetectModels) {
        await this.detectAvailableModels();
      }

      // 5. Utwórz plik konfiguracyjny codemcp
      await this.createConfigFile();

      // 6. Powiadom UI o zakończeniu inicjalizacji
      await vscode.commands.executeCommand(`${extensionName}.initCompleted`, {
        projectPath: this.projectPath
      });

      this.outputChannel.appendLine('✅ Inicjalizacja codemcp zakończona pomyślnie.');
      vscode.window.showInformationMessage(`Inicjalizacja codemcp dla ${this.projectPath} zakończona pomyślnie.`);

    } catch (error) {
      const errorMessage = `Błąd inicjalizacji codemcp: ${error instanceof Error ? error.message : String(error)}`;
      this.outputChannel.appendLine(`❌ ${errorMessage}`);
      vscode.window.showErrorMessage(errorMessage);
      throw error;
    }
  }

  /**
   * Tworzy strukturę katalogów potrzebną dla codemcp
   */
  private async createDirectoryStructure(): Promise<void> {
    this.outputChannel.appendLine('Tworzenie struktury katalogów...');

    // Katalogi do utworzenia
    const directories = [
      path.join(this.projectPath, '.kodu'),
      path.join(this.projectPath, '.kodu', 'cache'),
      path.join(this.projectPath, '.kodu', 'logs'),
      path.join(this.projectPath, '.kodu', 'models'),
      path.join(this.projectPath, '.kodu', 'plugins'),
    ];

    // Utwórz katalogi
    for (const dir of directories) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        this.outputChannel.appendLine(`Utworzono katalog: ${dir}`);
      }
    }
  }

  /**
   * Inicjalizuje integrację z Roo dla wszystkich modeli
   */
  private async initializeRooIntegration(): Promise<void> {
    this.outputChannel.appendLine('Inicjalizacja integracji z Roo...');

    // Utworzenie pliku konfiguracyjnego Roo
    const rooConfigPath = path.join(this.projectPath, '.kodu', 'roo-config.json');
    const rooConfig = {
      version: "1.0.0",
      supportedModels: [
        "gpt-4",
        "gpt-3.5-turbo",
        "claude-3-opus",
        "claude-3-sonnet",
        "gemini-pro",
        "mistral-medium",
        "mixtral-8x7b",
        "llama-3",
        "codestral",
        "deepseek-coder"
      ],
      toolsIntegration: {
        enabled: true,
        universalToolFormat: true
      }
    };

    fs.writeFileSync(rooConfigPath, JSON.stringify(rooConfig, null, 2));
    this.outputChannel.appendLine(`Utworzono konfigurację Roo: ${rooConfigPath}`);

    // Uruchom komendę inicjalizacji Roo
    await vscode.commands.executeCommand(`${extensionName}.initRooIntegration`);
  }

  /**
   * Wykrywa dostępne modele AI
   */
  private async detectAvailableModels(): Promise<void> {
    this.outputChannel.appendLine('Wykrywanie dostępnych modeli AI...');

    // Sprawdź dostępność kluczy API dla różnych dostawców
    const apiKeys = {
      openai: process.env.OPENAI_API_KEY,
      anthropic: process.env.ANTHROPIC_API_KEY,
      google: process.env.GOOGLE_API_KEY,
      mistral: process.env.MISTRAL_API_KEY,
      openrouter: process.env.OPENROUTER_API_KEY
    };

    const availableProviders = Object.entries(apiKeys)
      .filter(([_, key]) => !!key)
      .map(([provider, _]) => provider);

    this.outputChannel.appendLine(`Znaleziono klucze API dla dostawców: ${availableProviders.join(', ') || 'brak'}`);

    // Zapisz informacje do pliku
    const modelsInfoPath = path.join(this.projectPath, '.kodu', 'available-models.json');
    fs.writeFileSync(modelsInfoPath, JSON.stringify({
      availableProviders,
      detectedAt: new Date().toISOString()
    }, null, 2));
  }

  /**
   * Tworzy plik konfiguracyjny codemcp
   */
  private async createConfigFile(): Promise<void> {
    this.outputChannel.appendLine('Tworzenie pliku konfiguracyjnego codemcp...');

    const configPath = path.join(this.projectPath, 'codemcp.toml');
    
    // Preferowane modele (domyślne lub z konfiguracji)
    const preferredModels = this.config.preferredModels || [
      "claude-3-opus-20240229",
      "gpt-4",
      "gemini-pro",
      "mistral-medium"
    ];

    const configContent = `
# Konfiguracja codemcp
[general]
project_name = "${path.basename(this.projectPath)}"
initialized = true
initialized_at = "${new Date().toISOString()}"

[models]
preferred = [${preferredModels.map(m => `"${m}"`).join(', ')}]
fallback = "claude-3-sonnet-20240229"

[tools]
universal_format = true
allow_file_operations = true
allow_web_browsing = true
allow_system_commands = true

[roo]
enabled = true
universal_tools = true
`;

    fs.writeFileSync(configPath, configContent);
    this.outputChannel.appendLine(`Utworzono plik konfiguracyjny: ${configPath}`);
  }

  /**
   * Statyczna metoda inicjalizacji dla łatwiejszego użycia
   * @param projectPath Ścieżka do projektu
   * @param outputChannel Kanał wyjściowy do logowania
   * @param options Opcje inicjalizacji
   * @returns Promise<void>
   */
  public static async init(
    projectPath: string,
    outputChannel: vscode.OutputChannel,
    options: Partial<InitConfig> = {}
  ): Promise<void> {
    const config: InitConfig = {
      projectPath,
      autoDetectModels: options.autoDetectModels ?? true,
      preferredModels: options.preferredModels
    };

    const initializer = new CodeMcpInit(config, outputChannel);
    await initializer.initialize();
  }
}