/**
 * @fileoverview Integracja UI dla trybów Roo
 * Dostarcza komponenty UI i funkcje obsługi dla interfejsu użytkownika trybów Roo.
 */

import { ExtensionProvider } from '../../../providers/extension-provider';
import { RooMode, RooModeOptions } from '../modes/roo-mode-manager';

/**
 * Generuje komponent przełącznika trybów w formacie HTML dla webview
 * @param currentMode Aktualny tryb Roo
 * @param modes Lista wszystkich trybów
 * @returns Kod HTML komponentu przełącznika trybów
 */
export function generateRooModeSwitcher(currentMode: RooMode, modes: { mode: RooMode; options: RooModeOptions }[]): string {
  const html = `
  <div class="roo-mode-switcher">
    <div class="roo-mode-switcher-title">Tryby Claude Coder</div>
    <div class="roo-mode-switcher-buttons">
      ${modes.map(({ mode, options }) => `
        <button class="roo-mode-button ${mode === currentMode ? 'active' : ''}" data-mode="${mode}">
          <div class="roo-mode-icon">${getIconSvg(options.icon)}</div>
          <div class="roo-mode-name">${options.name}</div>
        </button>
      `).join('')}
    </div>
  </div>
  `;

  return html;
}

/**
 * Generuje CSS dla komponentów UI trybów Roo
 * @returns Kod CSS dla komponentów UI trybów Roo
 */
export function generateRooModeStyles(): string {
  return `
  .roo-mode-switcher {
    margin: 10px 0;
    padding: 10px;
    border-radius: 6px;
    background-color: var(--vscode-editor-background);
  }

  .roo-mode-switcher-title {
    font-size: 12px;
    margin-bottom: 8px;
    color: var(--vscode-foreground);
    font-weight: bold;
  }

  .roo-mode-switcher-buttons {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .roo-mode-button {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 8px;
    border-radius: 6px;
    background-color: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
    border: none;
    cursor: pointer;
    min-width: 70px;
    transition: background-color 0.2s;
  }

  .roo-mode-button:hover {
    background-color: var(--vscode-button-secondaryHoverBackground);
  }

  .roo-mode-button.active {
    background-color: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
  }

  .roo-mode-icon {
    margin-bottom: 4px;
  }

  .roo-mode-name {
    font-size: 12px;
  }
  `;
}

/**
 * Generuje skrypty klienckie dla obsługi komponentów UI trybów Roo
 * @returns Kod JavaScript dla obsługi komponentów UI trybów Roo
 */
export function generateRooModeScripts(): string {
  return `
  // Inicjalizacja przełącznika trybów Roo
  function initRooModeSwitcher() {
    const buttons = document.querySelectorAll('.roo-mode-button');
    buttons.forEach(button => {
      button.addEventListener('click', () => {
        const mode = button.dataset.mode;
        if (mode) {
          // Wysyłanie komunikatu do rozszerzenia VSCode
          vscode.postMessage({
            type: 'command',
            command: 'rooModeSwitched',
            mode: mode
          });
        }
      });
    });
  }

  // Aktualizacja aktywnego przycisku trybu
  function updateActiveRooModeButton(mode) {
    const buttons = document.querySelectorAll('.roo-mode-button');
    buttons.forEach(button => {
      if (button.dataset.mode === mode) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    });
  }

  // Nasłuchiwanie na zdarzenia przełączania trybów
  window.addEventListener('message', (event) => {
    const message = event.data;
    if (message.type === 'action' && message.action === 'rooModeChanged') {
      updateActiveRooModeButton(message.data.currentMode);
    }
  });

  // Inicjalizacja po załadowaniu strony
  document.addEventListener('DOMContentLoaded', () => {
    initRooModeSwitcher();
  });
  `;
}

/**
 * Obsługuje wiadomości z webview dotyczące trybów Roo
 * @param provider Dostawca rozszerzenia
 * @param message Wiadomość z webview
 * @returns True, jeśli wiadomość została obsłużona
 */
export function handleRooModeMessage(provider: ExtensionProvider, message: any): boolean {
  if (message.type === 'command' && message.command === 'rooModeSwitched') {
    const mode = message.mode as RooMode;
    if (mode && Object.values(RooMode).includes(mode)) {
      // Przełącz tryb za pomocą menedżera trybów
      provider.rooModeManager.switchMode(mode);
      return true;
    }
  }
  
  return false;
}

/**
 * Pobiera ikonę SVG dla trybu Roo
 * @param iconName Nazwa ikony
 * @returns Ikona SVG
 */
function getIconSvg(iconName: string): string {
  const icons: Record<string, string> = {
    'code': `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M10.9 8.7l-4 4L8 14l5-5-5-5-1.1 1.3L10.9 8.7zM5.1 7.3l4-4L8 2 3 7l5 5 1.1-1.3L5.1 7.3z"/>
    </svg>`,
    
    'law': `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M7.5 1l-6 6 6 6V1zm1 0v12l6-6-6-6z"/>
    </svg>`,
    
    'question': `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 1c-1.5 0-2.5.5-3.25 1.25S3.5 4 3.5 5.5h2c0-1 .25-1.5.75-2s1-.5 1.75-.5 1.25 0 1.75.5.75 1 .75 2c0 .5-.12.9-.38 1.2-.13.2-.27.35-.45.5l-.3.3L9 8l-.5.5c-.25.38-.5.88-.5 1.5V11h2v-1c0-.5.12-.9.38-1.2.13-.2.27-.35.45-.5l.3-.3.62-.5.5-.5c.25-.38.5-.88.5-1.5 0-1.5-.5-2.25-1.25-3S9.5 1 8 1zM7 13v2h2v-2H7z"/>
    </svg>`,
    
    'bug': `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 4a4 4 0 0 0-4 4v1h8V8a4 4 0 0 0-4-4zm0 9a4 4 0 0 0 4-4H4a4 4 0 0 0 4 4zm4.54-7.47l1.53-1.53-1.06-1.06-1.53 1.53a6 6 0 0 1 1.06 1.06zM11 12.44c.73-.5 1.33-1.1 1.83-1.83l1.55 1.54-1.06 1.06-2.32-2.32V12.44zm-6 0v1.55l-2.32-2.32-1.06 1.06 1.54 1.55a6 6 0 0 1 1.84-1.84zM2.93 4.5L1.87 3.43l1.06-1.06 1.54 1.53a6 6 0 0 1 1.07-1.06L4 1.3 2.93 2.37 4.47 3.9A6 6 0 0 0 3.9 4.47L2.93 4.5z"/>
    </svg>`
  };

  return icons[iconName] || `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <circle cx="8" cy="8" r="4"/>
  </svg>`;
}
