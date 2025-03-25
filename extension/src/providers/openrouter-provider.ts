// ...istniejący kod...

// openrouter-provider.ts

/**
 * Klasa OpenRouterProvider obsługuje komunikację z OpenRouterem.
 * @class OpenRouterProvider
 */
class OpenRouterProvider {
    private apiKey: string;

    /**
     * Inicjalizuje dostawcę z kluczem API.
     * @param {string} apiKey - Klucz API OpenRoutera.
     */
    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    /**
     * Wyślij zapytanie do OpenRoutera.
     * @param {string} prompt - Prompt do wysłania.
     * @returns {Promise<string>} - Odpowiedź z OpenRoutera.
     */
    async sendRequest(prompt: string): Promise<string> {
        const response = await fetch('https://api.openrouter.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'openrouter/auto',
                messages: [{ role: 'user', content: prompt }]
            })
        });

        if (!response.ok) {
            throw new Error(`Błąd podczas komunikacji z OpenRouterem: ${response.statusText}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    }
}

export default OpenRouterProvider;

// ...istniejący kod...
