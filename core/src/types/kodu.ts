import { Anthropic } from "@anthropic-ai/sdk";

export interface KoduDevOptions {
  maxRequestsPerTask?: number;
  customInstructions?: string;
  alwaysAllowReadOnly?: boolean;
  experimentalTerminal?: boolean;
  alwaysAllowWriteOnly?: boolean;
  creativeMode?: "creative" | "normal" | "deterministic";
  task?: string;
  images?: string[];
  /**
   * If true, the task will start with debugging the project
   */
  isDebug?: boolean;
}

export interface KoduDevState {
  taskId: string;
  requestCount: number;
  apiConversationHistory: Anthropic.MessageParam[];
  askResponseText?: string;
  askResponseImages?: string[];
  lastMessageTs?: number;
  abort: boolean;
  memory?: string;
  dirAbsolutePath?: string;
  isRepoInitialized?: boolean;
}
