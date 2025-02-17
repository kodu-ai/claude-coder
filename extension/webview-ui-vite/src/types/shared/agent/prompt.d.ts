export declare const conditionalBlocks: readonly ["vision"];
export declare const templatePlaceHolder: readonly ["agentName", "osName", "defaultShell", "homeDir", "cwd", "toolSection", "capabilitiesSection", "rulesSection", "task"];
declare const placeHolderNames: readonly ["agentName", "osName", "defaultShell", "homeDir", "cwd", "toolSection", "capabilitiesSection", "rulesSection", "task", "vision"];
export type PlaceHolderName = (typeof placeHolderNames)[number];
export type ConditionalBlock = (typeof conditionalBlocks)[number];
export interface TemplateInfo {
    name: string;
    isActive: boolean;
}
export interface TemplatePlaceholder {
    description: string;
}
export interface TemplateHighlighterProps {
    text: string;
    scrollTop: number;
}
export declare const TEMPLATE_PLACEHOLDERS: Record<PlaceHolderName, TemplatePlaceholder>;
export declare const editorVariable: string;
export declare const PLACEHOLDER_NAMES: string[];
export {};
