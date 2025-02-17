import { ToolName } from "../../tools/types";
import { templatePlaceHolder, ConditionalBlock } from "../../../../shared/agent/prompt";
export interface TemplateValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}
export interface TemplateProcessingOptions {
    preserveWhitespace?: boolean;
    removeEmptyLines?: boolean;
}
export type TemplatePlaceholder = (typeof templatePlaceHolder)[number];
type ExtractPlaceholders<T extends string> = T extends `${infer Start}{{#${infer Block}}}${infer Content}{{/${infer EndBlock}}}${infer Rest}` ? Block extends ConditionalBlock ? EndBlock extends Block ? ExtractPlaceholders<`${Start}${Content}${Rest}`> : never : never : T extends `${infer _Start}{{${infer P}}}${infer Rest}` ? P extends TemplatePlaceholder ? ExtractPlaceholders<Rest> : never : T;
export type ValidTemplateString<T extends string> = ExtractPlaceholders<T> extends never ? never : T;
export interface ToolParameter {
    type: string;
    description: string;
    required: boolean | string;
}
export interface ToolExample {
    description: string;
    output: string;
    memory?: string;
    thinking?: string;
}
export interface ToolPromptSchema {
    name: ToolName;
    description: string;
    parameters: Record<string, ToolParameter>;
    extraDescriptions?: string;
    capabilities: string[];
    examples: ToolExample[];
    requiresFeatures?: ConditionalBlock[];
}
export interface Section {
    name: TemplatePlaceholder;
    content: string;
}
export interface PromptConfig {
    task?: string;
    agentName: string;
    osName: string;
    defaultShell: string;
    homeDir: string;
    template: ValidTemplateString<string>;
    features?: {
        [K in ConditionalBlock]?: boolean;
    };
}
export declare function promptTemplate(fn: (b: Record<TemplatePlaceholder, string>, helpers: {
    block: (type: ConditionalBlock, content: string) => string;
}) => string): string;
export declare function buildPromptFromTemplate(template: string, task?: string): Promise<string>;
export {};
