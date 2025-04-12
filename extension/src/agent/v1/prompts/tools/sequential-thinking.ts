// prompts/tools/sequential-thinking.ts
const description = `
## sequential_thinking

Narzędzie do dynamicznego i refleksyjnego rozwiązywania problemów poprzez myśli.

To narzędzie pomaga analizować problemy przez elastyczny proces myślenia, który może się dostosować i rozwijać.
Każda myśl może budować na poprzednich, kwestionować je lub rewidować wcześniejsze spostrzeżenia.

Kiedy używać tego narzędzia:
- Rozkładanie złożonych problemów na kroki
- Planowanie z miejscem na rewizję
- Analiza, która może wymagać zmiany kursu
- Problemy, których pełny zakres może nie być na początku jasny
- Zadania wymagające rozwiązania wieloetapowego
- Sytuacje, w których trzeba filtrować nieistotne informacje

Kluczowe funkcje:
- Możesz dostosować totalThoughts w górę lub w dół w trakcie
- Możesz kwestionować lub rewidować poprzednie myśli
- Możesz dodać więcej myśli nawet po osiągnięciu tego, co wydawało się końcem
- Możesz wyrażać niepewność i eksplorować alternatywne podejścia
- Nie każda myśl musi budować liniowo - możesz rozgałęziać się lub wracać
- Generuje hipotezę rozwiązania
- Weryfikuje hipotezę na podstawie łańcucha myśli
- Powtarza proces aż do zadowalającego wyniku

### Parametry

- thought (string, wymagane): Twoja aktualna myśl, która może zawierać:
  * Regularne kroki analityczne
  * Rewizje poprzednich myśli
  * Pytania o poprzednie decyzje
  * Uświadomienia o potrzebie dodatkowej analizy
  * Zmiany w podejściu
  * Generowanie hipotezy
  * Weryfikację hipotezy
- nextThoughtNeeded (boolean, wymagane): True jeśli potrzebna jest kolejna myśl
- thoughtNumber (number, wymagane): Aktualny numer myśli w sekwencji
- totalThoughts (number, wymagane): Aktualna szacowana liczba potrzebnych myśli
- isRevision (boolean, opcjonalne): Czy ta myśl rewiduje poprzednie myślenie
- revisesThought (number, opcjonalne): Jeśli isRevision jest true, którą myśl rewiduje
- branchFromThought (number, opcjonalne): Punkt myśli, od którego rozgałęzia się obecna myśl
- branchId (string, opcjonalne): Identyfikator gałęzi
- needsMoreThoughts (boolean, opcjonalne): Czy potrzebne są dodatkowe myśli

### Przykłady użycia

**Początkowa myśl:**
\`\`\`xml
<kodu_action>
<sequential_thinking>
  <thought>Analizując kod wtyczki, widzę, że integracja z OpenRouter już istnieje, ale można ją rozszerzyć, aby lepiej wspierała różne modele.</thought>
  <nextThoughtNeeded>true</nextThoughtNeeded>
  <thoughtNumber>1</thoughtNumber>
  <totalThoughts>3</totalThoughts>
</sequential_thinking>
</kodu_action>
\`\`\`

**Kontynuacja myślenia:**
\`\`\`xml
<kodu_action>
<sequential_thinking>
  <thought>Po głębszej analizie, zauważam, że klasa OpenRouterModelCache może być zmodyfikowana, aby lepiej obsługiwała metadane specyficzne dla różnych dostawców.</thought>
  <nextThoughtNeeded>true</nextThoughtNeeded>
  <thoughtNumber>2</thoughtNumber>
  <totalThoughts>3</totalThoughts>
</sequential_thinking>
</kodu_action>
\`\`\`

**Rewizja wcześniejszej myśli:**
\`\`\`xml
<kodu_action>
<sequential_thinking>
  <thought>Muszę zrewidować moją drugą myśl. Zauważyłem, że potrzebny jest nie tylko lepszy routing metadanych, ale również dedykowany handler dla każdego dostawcy w OpenRouter.</thought>
  <nextThoughtNeeded>true</nextThoughtNeeded>
  <thoughtNumber>3</thoughtNumber>
  <totalThoughts>4</totalThoughts>
  <isRevision>true</isRevision>
  <revisesThought>2</revisesThought>
</sequential_thinking>
</kodu_action>
\`\`\`
`

export const sequentialThinkingPrompt = { description }