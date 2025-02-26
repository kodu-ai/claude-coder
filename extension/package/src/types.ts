import type { LanguageModelV1 } from '@ai-sdk/provider';

// Re-export the LanguageModelV1 type to ensure proper type compatibility
export type { LanguageModelV1 };

// Export our model types with explicit type constraints
export type OpenRouterLanguageModel = LanguageModelV1;

export type OpenRouterSharedSettings = {
  /**
   * List of model IDs to try in order if the primary model fails, e.g. ["anthropic/claude-2","gryphe/mythomax-l2-13b"]
   */
  models?: string[];

  /**
   * @deprecated use `reasoning` instead
   */
  includeReasoning?: boolean;

  /**
   * https://openrouter.ai/docs/use-cases/reasoning-tokens
   * One of `max_tokens` or `effort` is required.
   * If `exclude` is true, reasoning will be removed from the response. Default is false.
   */
  reasoning?: {
    exclude?: boolean;
  } & (
    | {
        max_tokens: number;
      }
    | {
        effort: 'high' | 'medium' | 'low';
      }
  );

  extraBody?: Record<string, any>;

  /**
A unique identifier representing your end-user, which can help OpenRouter to
monitor and detect abuse.
   */
  user?: string;
};
