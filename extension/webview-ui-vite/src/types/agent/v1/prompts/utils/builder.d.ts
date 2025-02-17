import { PromptConfig, ToolPromptSchema, TemplatePlaceholder, TemplateProcessingOptions } from "./utils";
import { ConditionalBlock } from "../../../../shared/agent/prompt";
export declare class PromptBuilder {
    private config;
    private capabilities;
    private tools;
    private sections;
    constructor(config: PromptConfig);
    private validateConfig;
    private validateTemplate;
    private validateToolParameters;
    private validateToolExamples;
    private validateTool;
    private validateToolConditionalBlock;
    addTools(tools: ToolPromptSchema[]): this;
    addTool(tool: ToolPromptSchema): this;
    addCapability(capability: string): this;
    addSection(name: TemplatePlaceholder, content: string): this;
    private generateSectionContent;
    private processTemplate;
    build(options?: TemplateProcessingOptions): string;
    getFeatures(): Record<ConditionalBlock, boolean>;
    setFeatures(features: Partial<Record<ConditionalBlock, boolean>>): this;
}
