import { ExtensionProvider } from "../extension-provider";
export declare class ApiManager {
    private static instance;
    private context;
    private constructor();
    static getInstance(context?: ExtensionProvider): ApiManager;
    getCurrentModelInfo(): Promise<import("../../api/providers/types").ModelInfo>;
    saveKoduApiKey(apiKey: string): Promise<void>;
    signOutKodu(): Promise<void>;
    fetchKoduCredits(): Promise<void>;
    private fetchKoduUser;
}
