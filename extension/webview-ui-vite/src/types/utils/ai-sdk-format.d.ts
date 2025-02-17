import { Anthropic } from "@anthropic-ai/sdk";
import { CoreMessage } from "ai";
export declare function convertToAISDKFormat(anthropicMessages: Anthropic.Messages.MessageParam[]): CoreMessage[];
