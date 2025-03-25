/**
 * @fileoverview Parser dla poleceń narzędzi w formacie XML używanym przez Roo
 * Umożliwia ekstrakcję nazw narzędzi i parametrów z formatu XML oraz konwersję
 * między formatem Roo a formatem Claude Coder.
 */

/**
 * Interfejs dla funkcji callback obsługujących zdarzenia parsera
 */
interface RooXmlParserCallbacks {
  /** Wywoływane, gdy parser znajdzie początek tagu narzędzia */
  onToolStart?: (toolName: string) => void;
  /** Wywoływane, gdy parser znajdzie zakończenie tagu narzędzia */
  onToolEnd?: (toolName: string, params: Record<string, string>) => void;
  /** Wywoływane, gdy parser znajdzie błąd w XML */
  onError?: (error: Error) => void;
}

/**
 * Klasa parsera XML dla poleceń narzędzi Roo
 */
export class RooXmlParser {
  /** Stan bieżącego parsowania */
  private parseState: {
    currentToolName: string | null;
    currentParamName: string | null;
    currentParamValue: string;
    params: Record<string, string>;
    inTag: boolean;
    inClosingTag: boolean;
    tagBuffer: string;
  };

  /** Callbacks dla zdarzeń parsera */
  private callbacks: RooXmlParserCallbacks;

  /**
   * Konstruktor klasy RooXmlParser
   * @param callbacks Funkcje callback dla zdarzeń parsera
   */
  constructor(callbacks: RooXmlParserCallbacks = {}) {
    this.callbacks = callbacks;
    this.resetParseState();
  }

  /**
   * Resetuje stan parsowania
   */
  public resetParseState(): void {
    this.parseState = {
      currentToolName: null,
      currentParamName: null,
      currentParamValue: '',
      params: {},
      inTag: false,
      inClosingTag: false,
      tagBuffer: '',
    };
  }

  /**
   * Parsuje tekst zawierający polecenia XML dla narzędzi Roo
   * @param text Tekst do parsowania
   */
  public parse(text: string): void {
    try {
      // Usuń białe znaki na początku i końcu
      text = text.trim();

      // Jeśli tekst nie zawiera znaczników XML, nie ma czego parsować
      if (!text.includes('<') || !text.includes('>')) {
        return;
      }

      for (let i = 0; i < text.length; i++) {
        const char = text[i];

        // Obsługa znaczników XML
        if (char === '<') {
          this.parseState.inTag = true;
          this.parseState.inClosingTag = text[i + 1] === '/';
          this.parseState.tagBuffer = '';
          continue;
        }

        if (this.parseState.inTag && char === '>') {
          this.parseState.inTag = false;
          this.handleTagEnd();
          continue;
        }

        if (this.parseState.inTag) {
          // Pomijamy początkowy znak '/' w zamykającym tagu
          if (this.parseState.inClosingTag && this.parseState.tagBuffer.length === 0 && char === '/') {
            continue;
          }
          this.parseState.tagBuffer += char;
        } else if (this.parseState.currentParamName) {
          // Zbieramy wartość parametru
          this.parseState.currentParamValue += char;
        }
      }
    } catch (error) {
      if (this.callbacks.onError) {
        this.callbacks.onError(error instanceof Error ? error : new Error(String(error)));
      } else {
        console.error('Błąd parsowania XML:', error);
      }
    }
  }

  /**
   * Obsługuje zakończenie tagu XML
   */
  private handleTagEnd(): void {
    if (this.parseState.inClosingTag) {
      // Obsługa zamykającego tagu
      const tagName = this.parseState.tagBuffer.trim();

      if (tagName === this.parseState.currentToolName) {
        // Zakończenie tagu narzędzia
        if (this.callbacks.onToolEnd) {
          this.callbacks.onToolEnd(tagName, { ...this.parseState.params });
        }
        this.resetParseState();
      } else if (tagName === this.parseState.currentParamName) {
        // Zakończenie tagu parametru
        this.parseState.params[tagName] = this.parseState.currentParamValue;
        this.parseState.currentParamName = null;
        this.parseState.currentParamValue = '';
      }
    } else {
      // Obsługa otwierającego tagu
      const tagName = this.parseState.tagBuffer.trim();

      if (!this.parseState.currentToolName) {
        // To jest tag narzędzia
        this.parseState.currentToolName = tagName;
        if (this.callbacks.onToolStart) {
          this.callbacks.onToolStart(tagName);
        }
      } else if (!this.parseState.currentParamName) {
        // To jest tag parametru
        this.parseState.currentParamName = tagName;
        this.parseState.currentParamValue = '';
      }
    }
  }

  /**
   * Sprawdza, czy parser jest obecnie w trakcie parsowania tagu narzędzia
   * @returns True, jeśli parser jest w trakcie parsowania tagu narzędzia
   */
  public get isInToolTag(): boolean {
    return this.parseState.currentToolName !== null;
  }

  /**
   * Sprawdza, czy parser jest obecnie w trakcie parsowania parametru
   * @returns True, jeśli parser jest w trakcie parsowania parametru
   */
  public get isInParamTag(): boolean {
    return this.parseState.currentParamName !== null;
  }

  /**
   * Zwraca aktualnie przetwarzane narzędzie
   * @returns Nazwa aktualnie przetwarzanego narzędzia lub null
   */
  public get currentToolName(): string | null {
    return this.parseState.currentToolName;
  }

  /**
   * Zwraca aktualne parametry
   * @returns Obiekt z aktualnymi parametrami
   */
  public get currentParams(): Record<string, string> {
    return { ...this.parseState.params };
  }
}
