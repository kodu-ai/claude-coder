/**
 * @fileoverview Menedżer trybów w stylu Roo dla Claude Coder
 * Zarządza różnymi trybami pracy asystenta podobnie jak w Roo Code,
 * dostosowując zachowanie i dostępne narzędzia do aktualnego kontekstu.
 */

import { RooToolsManager } from "../tools/roo-tools-manager";
import { EventEmitter } from "events";

/**
 * Dostępne tryby pracy asystenta
 */
export enum RooMode {
  CODE = "code",
  ARCHITECT = "architect",
  ASK = "ask",
  DEBUG = "debug"
}

/**
 * Interfejs opcji trybu
 */
export interface RooModeOptions {
  /** Nazwa trybu */
  name: string;
  /** Krótki opis trybu */
  description: string;
  /** Ikona dla trybu */
  icon: string;
  /** Pełna instrukcja systemowa dla trybu */
  systemPrompt: string;
  /** Domyślne narzędzia dostępne w trybie */
  availableTools: string[];
}

/**
 * Klasa zarządzająca trybami Roo
 */
export class RooModeManager extends EventEmitter {
  /** Aktualnie wybrany tryb */
  private currentMode: RooMode = RooMode.CODE;
  /** Referencja do menedżera narzędzi */
  private toolsManager: RooToolsManager;
  /** Definicje trybów */
  private modes: Map<RooMode, RooModeOptions> = new Map();

  /**
   * Konstruktor klasy RooModeManager
   * @param toolsManager Menedżer narzędzi
   */
  constructor(toolsManager: RooToolsManager) {
    super();
    this.toolsManager = toolsManager;
    this.initModes();
  }

  /**
   * Inicjalizuje dostępne tryby pracy z domyślnymi wartościami
   */
  private initModes(): void {
    // Tryb CODE - programowanie
    this.modes.set(RooMode.CODE, {
      name: "Code",
      description: "Asystent programisty, expert w wielu językach i frameworkach",
      icon: "code",
      systemPrompt: `Jesteś Claude Coder, wysoko wykwalifikowanym inżynierem oprogramowania z rozległą wiedzą na temat wielu języków programowania, frameworków, wzorców projektowych i najlepszych praktyk. Twoim celem jest pomoc użytkownikowi w tworzeniu, debugowaniu i optymalizacji kodu.

Podczas pracy:
1. Analizuj problemy krok po kroku i rozdzielaj je na mniejsze zadania
2. Zawsze korzystaj z najlepszych praktyk dla danego języka/frameworka
3. Gdy napotykasz problemy, wyjaśnij je jasno i proponuj rozwiązania
4. Wykorzystuj dostępne narzędzia (odczyt/zapis plików, wykonywanie komend)
5. Regularnie pytaj o informacje zwrotne, aby upewnić się, że tworzony kod spełnia oczekiwania

Zadawaj pytania tylko wtedy, gdy są absolutnie niezbędne do realizacji zadania.`,
      availableTools: [
        "read_file",
        "search_files",
        "list_files",
        "execute_command", 
        "apply_diff",
        "write_to_file",
        "list_code_definition_names",
        "ask_followup_question",
        "attempt_completion"
      ]
    });

    // Tryb ARCHITECT - planowanie i architektura
    this.modes.set(RooMode.ARCHITECT, {
      name: "Architect",
      description: "Doświadczony projektant architektury oprogramowania",
      icon: "law",
      systemPrompt: `Jesteś Claude Architect, doświadczonym projektantem systemów i architektem oprogramowania. Twoim celem jest pomoc użytkownikowi w planowaniu, projektowaniu i dokumentowaniu architektury systemu.

Podczas pracy:
1. Zadawaj dociekliwe pytania, aby lepiej zrozumieć wymagania
2. Dziel projekty na logiczne komponenty i warstwy
3. Proponuj wzorce architektoniczne odpowiednie dla kontekstu
4. Twórz jasną i zwięzłą dokumentację projektową
5. Myśl o skalowalności, bezpieczeństwie i wydajności od początku

Na tym etapie unikaj pisania szczegółowego kodu - skup się na strukturze wysokiego poziomu i dokumentacji.`,
      availableTools: [
        "read_file",
        "list_files",
        "search_files",
        "write_to_file",
        "ask_followup_question",
        "attempt_completion"
      ]
    });

    // Tryb ASK - pytania i odpowiedzi
    this.modes.set(RooMode.ASK, {
      name: "Ask",
      description: "Asystent techniczny odpowiadający na pytania",
      icon: "question",
      systemPrompt: `Jesteś Claude Ask, kompetentnym asystentem technicznym skoncentrowanym na odpowiadaniu na pytania i dostarczaniu informacji o rozwoju oprogramowania, technologiach i powiązanych tematach.

Podczas pracy:
1. Odpowiadaj zwięźle i precyzyjnie na pytania użytkownika
2. Wyjaśniaj koncepcje techniczne w sposób przystępny
3. Używaj przykładów, gdy są pomocne w zrozumieniu
4. Informuj o najlepszych praktykach i standardach branżowych
5. Przyznawaj się do ograniczeń swojej wiedzy, gdy nie jesteś pewien

Skup się na dostarczaniu użytecznych informacji, a nie na wykonywaniu zadań.`,
      availableTools: [
        "read_file",
        "search_files",
        "list_files",
        "ask_followup_question",
        "attempt_completion"
      ]
    });

    // Tryb DEBUG - debugowanie
    this.modes.set(RooMode.DEBUG, {
      name: "Debug",
      description: "Ekspert debugowania rozwiązujący problemy w kodzie",
      icon: "bug",
      systemPrompt: `Jesteś Claude Debug, ekspertem w systematycznym diagnozowaniu i rozwiązywaniu problemów w kodzie. Twoim celem jest pomoc użytkownikowi w identyfikowaniu i naprawianiu błędów.

Podczas pracy:
1. Systematycznie analizuj problemy, szukając głównych przyczyn
2. Wyjaśniaj dokładnie, co powoduje błąd i jak go naprawić
3. Proponuj rozwiązania oparte na najlepszych praktykach
4. Pomagaj w testowaniu i weryfikacji napraw
5. Sugeruj usprawnienia, które zapobiegną podobnym problemom w przyszłości

Skupiaj się na rozwiązywaniu konkretnych problemów i błędów w istniejącym kodzie.`,
      availableTools: [
        "read_file",
        "search_files",
        "list_files",
        "execute_command",
        "apply_diff",
        "list_code_definition_names",
        "ask_followup_question",
        "attempt_completion"
      ]
    });
  }

  /**
   * Przełącza na wybrany tryb pracy
   * @param mode Tryb do aktywacji
   * @returns Opcje wybranego trybu
   */
  public switchMode(mode: RooMode): RooModeOptions {
    if (!this.modes.has(mode)) {
      throw new Error(`Nieznany tryb: ${mode}`);
    }

    const previousMode = this.currentMode;
    this.currentMode = mode;
    
    // Pobierz opcje trybu
    const modeOptions = this.modes.get(mode)!;
    
    // Emituj zdarzenie zmiany trybu
    this.emit('modeChanged', {
      previousMode,
      currentMode: mode,
      modeOptions
    });

    return modeOptions;
  }

  /**
   * Pobiera aktualnie wybrany tryb
   * @returns Aktualny tryb
   */
  public getCurrentMode(): RooMode {
    return this.currentMode;
  }

  /**
   * Pobiera opcje dla aktualnego trybu
   * @returns Opcje aktualnego trybu
   */
  public getCurrentModeOptions(): RooModeOptions {
    return this.modes.get(this.currentMode)!;
  }

  /**
   * Pobiera instrukcję systemową dla aktualnego trybu
   * @returns Instrukcja systemowa
   */
  public getCurrentSystemPrompt(): string {
    return this.modes.get(this.currentMode)!.systemPrompt;
  }

  /**
   * Pobiera wszystkie dostępne tryby
   * @returns Lista wszystkich trybów
   */
  public getAllModes(): { mode: RooMode; options: RooModeOptions }[] {
    return Array.from(this.modes.entries()).map(([mode, options]) => ({
      mode,
      options
    }));
  }

  /**
   * Modyfikuje opcje trybu
   * @param mode Tryb do modyfikacji
   * @param options Nowe opcje (częściowe)
   */
  public updateModeOptions(mode: RooMode, options: Partial<RooModeOptions>): void {
    if (!this.modes.has(mode)) {
      throw new Error(`Nieznany tryb: ${mode}`);
    }

    const currentOptions = this.modes.get(mode)!;
    this.modes.set(mode, {
      ...currentOptions,
      ...options
    });

    // Emituj zdarzenie aktualizacji trybu
    this.emit('modeUpdated', {
      mode,
      options: this.modes.get(mode)
    });
  }

  /**
   * Sprawdza, czy narzędzie jest dostępne w aktualnym trybie
   * @param toolName Nazwa narzędzia
   * @returns True, jeśli narzędzie jest dostępne
   */
  public isToolAvailableInCurrentMode(toolName: string): boolean {
    const modeOptions = this.modes.get(this.currentMode);
    if (!modeOptions) {
      return false;
    }
    
    return modeOptions.availableTools.includes(toolName);
  }
}
