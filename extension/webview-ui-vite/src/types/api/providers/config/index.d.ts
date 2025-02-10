import { ProviderConfig } from "../types";
export declare const providerConfigs: Record<string, ProviderConfig>;
export declare const customProvidersConfigs: Record<string, ProviderConfig>;
export declare const models: import("../types").ModelInfo[];
export type ProviderConfigs = typeof providerConfigs;
export declare const getProviderConfig: (providerId: string) => ProviderConfig | undefined;
export declare const getModelConfig: (providerId: string, modelId: string) => import("../types").ModelInfo | undefined;
