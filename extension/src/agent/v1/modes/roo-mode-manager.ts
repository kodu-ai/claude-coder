/**
 * @fileoverview Menedżer trybów Roo
 * Zarządza różnymi trybami pracy (Code, Architect, Ask, Debug)
 * i przechowuje ich konfiguracje.
 */

import { EventEmitter } from "events";

/**
 * Typ wyliczeniowy dla trybów Roo
 */
export enum RooMode {
  CODE = "code",
  ARCHITECT = "architect",
  ASK = "ask",
  DEBUG = "debug",
}

/**
 * Interfejs opisujący opcje trybu Roo
 */
export interface RooModeOptions {
  /**
   * Nazwa trybu wyświetlana użytkownikowi
   */
  name: string;
  
  /**
   * Opis trybu wyświetlany użytkownikowi
   */
  description: string;
  
  /**
   * Prompt systemowy używany w trybie
   */
  systemPrompt: string;
  
  /**
   * Wzorce plików, które mogą być edytowane w tym trybie
   */
  allowedFilePatterns: string[];
}

/**
 * Klasa zarządzająca trybami Roo
 */
export class RooModeManager extends EventEmitter {
  /**
   * Mapa przechowująca opcje dla każdego trybu
   */
  private modes: Map<RooMode, RooModeOptions>;
  
  /**
   * Aktualnie wybrany tryb
   */
  private currentMode: RooMode;

  /**
   * Konstruktor klasy RooModeManager
   */
  constructor() {
    super();
    
    // Inicjalizacja domyślnych trybów
    this.modes = new Map<RooMode, RooModeOptions>();
    
    // Dodanie domyślnych trybów
    this.initializeDefaultModes();
    
    // Domyślny tryb to CODE
    this.currentMode = RooMode.CODE;
  }

  /**
   * Inicjalizuje domyślne tryby Roo
   */
  private initializeDefaultModes(): void {
    // Tryb Code
    this.modes.set(RooMode.CODE, {
      name: "Code",
      description: "Tryb programisty - umożliwia tworzenie i edycję kodu źródłowego",
      systemPrompt: `Jesteś Roo, wysoko wykwalifikowanym inżynierem oprogramowania z obszerną wiedzą w wielu językach programowania, frameworkach, wzorcach projektowych i najlepszych praktykach.`,
      allowedFilePatterns: [".*"],
    });

    // Tryb Architect
    this.modes.set(RooMode.ARCHITECT, {
      name: "Architect",
      description: "Tryb architekta - pomaga planować i projektować strukturę aplikacji",
      systemPrompt: `Jesteś Roo, doświadczonym liderem technicznym, który jest dociekliwy i doskonale planuje.`,
      allowedFilePatterns: ["\\.md$"],
    });

    // Tryb Ask
    this.modes.set(RooMode.ASK, {
      name: "Ask",
      description: "Tryb pytań - odpowiada na pytania i dostarcza informacji",
      systemPrompt: `Jesteś Roo, kompetentnym asystentem technicznym skupiającym się na odpowiadaniu na pytania i dostarczaniu informacji o rozwoju oprogramowania, technologii i pokrewnych tematach.`,
      allowedFilePatterns: ["\\.md$"],
    });

    // Tryb Debug
    this.modes.set(RooMode.DEBUG, {
      name: "Debug",
      description: "Tryb debugowania - pomaga diagnozować i rozwiązywać problemy",
      systemPrompt: `Jesteś Roo, ekspertem od debugowania oprogramowania specjalizującym się w systematycznej diagnozie i rozwiązywaniu problemów.`,
      allowedFilePatterns: [".*"],
    });
  }

  /**
   * Przełącza na określony tryb
   * @param mode Tryb, na który należy przełączyć
   * @throws Error jeśli tryb nie istnieje
   */
  public switchMode(mode: RooMode): void {
    if (!this.modes.has(mode)) {
      throw new Error(`Tryb ${mode} nie istnieje`);
    }

    const previousMode = this.currentMode;
    this.currentMode = mode;

    // Emituj zdarzenie o zmianie trybu
    this.emit('modeChanged', {
      previousMode,
      currentMode: mode,
      options: this.getCurrentModeOptions()
    });
  }

  /**
   * Pobiera aktualnie wybrany tryb
   * @returns Aktualny tryb
   */
  public getCurrentMode(): RooMode {
    return this.currentMode;
  }

  /**
   * Pobiera opcje dla aktualnie wybranego trybu
   * @returns Opcje dla aktualnego trybu
   */
  public getCurrentModeOptions(): RooModeOptions {
    const options = this.modes.get(this.currentMode);
    if (!options) {
      throw new Error(`Brak opcji dla trybu ${this.currentMode}`);
    }
    return options;
  }

  /**
   * Pobiera opcje dla określonego trybu
   * @param mode Tryb, dla którego należy pobrać opcje
   * @returns Opcje dla określonego trybu
   * @throws Error jeśli tryb nie istnieje
   */
  public getModeOptions(mode: RooMode): RooModeOptions {
    const options = this.modes.get(mode);
    if (!options) {
      throw new Error(`Tryb ${mode} nie istnieje`);
    }
    return options;
  }

  /**
   * Aktualizuje opcje dla określonego trybu
   * @param mode Tryb, dla którego należy zaktualizować opcje
   * @param options Nowe opcje lub częściowe opcje do zaktualizowania
   * @throws Error jeśli tryb nie istnieje
   */
  public updateModeOptions(mode: RooMode, options: Partial<RooModeOptions>): void {
    const currentOptions = this.modes.get(mode);
    if (!currentOptions) {
      throw new Error(`Tryb ${mode} nie istnieje`);
    }

    // Aktualizuj opcje, zachowując istniejące wartości dla niezdefiniowanych pól
    this.modes.set(mode, {
      ...currentOptions,
      ...options
    });

    // Jeśli aktualizowany jest aktualny tryb, emituj zdarzenie
    if (mode === this.currentMode) {
      this.emit('modeOptionsChanged', {
        mode,
        options: this.getModeOptions(mode)
      });
    }
  }

  /**
   * Dodaje nowy tryb
   * @param mode Identyfikator trybu
   * @param options Opcje dla nowego trybu
   * @throws Error jeśli tryb już istnieje
   */
  public addMode(mode: RooMode, options: RooModeOptions): void {
    if (this.modes.has(mode)) {
      throw new Error(`Tryb ${mode} już istnieje`);
    }

    this.modes.set(mode, options);
    this.emit('modeAdded', { mode, options });
  }

  /**
   * Usuwa tryb
   * @param mode Tryb do usunięcia
   * @throws Error jeśli tryb nie istnieje lub jest to aktualnie wybrany tryb
   */
  public removeMode(mode: RooMode): void {
    if (!this.modes.has(mode)) {
      throw new Error(`Tryb ${mode} nie istnieje`);
    }

    if (mode === this.currentMode) {
      throw new Error(`Nie można usunąć aktualnie wybranego trybu ${mode}`);
    }

    this.modes.delete(mode);
    this.emit('modeRemoved', { mode });
  }

  /**
   * Pobiera wszystkie dostępne tryby
   * @returns Tablica obiektów zawierających tryb i jego opcje
   */
  public getAllModes(): Array<{ mode: RooMode; options: RooModeOptions }> {
    return Array.from(this.modes.entries()).map(([mode, options]) => ({
      mode,
      options
    }));
  }

  /**
   * Sprawdza, czy plik może być edytowany w aktualnym trybie
   * @param filePath Ścieżka do pliku
   * @returns True, jeśli plik może być edytowany w aktualnym trybie
   */
  public canEditFile(filePath: string): boolean {
    const options = this.getCurrentModeOptions();
    return options.allowedFilePatterns.some(pattern => {
      const regex = new RegExp(pattern);
      return regex.test(filePath);
    });
  }

  /**
   * Resetuje wszystkie tryby do domyślnych ustawień
   */
  public resetToDefaults(): void {
    this.modes.clear();
    this.initializeDefaultModes();
    this.currentMode = RooMode.CODE;
    this.emit('modesReset');
  }
}
