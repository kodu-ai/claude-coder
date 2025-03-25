// schema/sequential_thinking.ts
import { z } from "zod"

/**
 * @tool sequential_thinking
 * @description Narzędzie do dynamicznego i refleksyjnego rozwiązywania problemów poprzez myśli.
 * Pozwala analizować problemy krok po kroku, z możliwością rewizji i budowania na wcześniejszych myślach.
 * @schema
 * {
 *   thought: string; // Aktualna myśl, którą możesz budować, rewidować lub kwestionować
 *   nextThoughtNeeded: boolean; // Czy potrzebna jest kolejna myśl
 *   thoughtNumber: number; // Aktualny numer myśli
 *   totalThoughts: number; // Szacowana liczba potrzebnych myśli
 *   isRevision: boolean; // Czy ta myśl rewiduje poprzednią
 *   revisesThought: number; // Jeśli isRevision=true, którą myśl rewiduje
 * }
 */
const schema = z.object({
  thought: z
    .string()
    .describe("Twoja aktualna myśl, którą możesz budować, rewidować lub kwestionować"),
  nextThoughtNeeded: z
    .boolean()
    .describe("Czy potrzebna jest kolejna myśl"),
  thoughtNumber: z
    .number()
    .int()
    .min(1)
    .describe("Aktualny numer myśli"),
  totalThoughts: z
    .number()
    .int()
    .min(1)
    .describe("Szacowana liczba potrzebnych myśli"),
  isRevision: z
    .boolean()
    .optional()
    .describe("Czy ta myśl rewiduje poprzednią"),
  revisesThought: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe("Jeśli isRevision=true, którą myśl rewiduje"),
  branchFromThought: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe("Punkt myśli, od którego rozgałęzia się obecna myśl"),
  branchId: z
    .string()
    .optional()
    .describe("Identyfikator gałęzi"),
  needsMoreThoughts: z
    .boolean()
    .optional()
    .describe("Czy potrzebne są dodatkowe myśli")
})

export const sequentialThinkingTool = {
  schema: {
    name: "sequential_thinking",
    schema,
  },
  examples: [
    `<tool name="sequential_thinking">
  <thought>Analizując kod wtyczki, widzę, że integracja z OpenRouter już istnieje, ale można ją rozszerzyć, aby lepiej wspierała różne modele.</thought>
  <nextThoughtNeeded>true</nextThoughtNeeded>
  <thoughtNumber>1</thoughtNumber>
  <totalThoughts>3</totalThoughts>
</tool>`,
  ],
}

export type SequentialThinkingToolParams = {
  name: "sequential_thinking"
  input: z.infer<typeof schema>
}