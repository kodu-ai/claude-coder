import * as vscode from "vscode";
type SecretState = {
    koduApiKey: string;
    fp: string;
    providers?: string;
};
export declare class SecretStateManager {
    private static instance;
    private context;
    private constructor();
    static getInstance(context?: vscode.ExtensionContext): SecretStateManager;
    updateSecretState<K extends keyof SecretState>(key: K, value: SecretState[K]): Promise<void>;
    deleteSecretState<K extends keyof SecretState>(key: K): Promise<void>;
    getSecretState<K extends keyof SecretState>(key: K): Promise<SecretState[K]>;
    resetState(): Promise<void>;
}
export {};
