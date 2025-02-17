export declare class DiagnosticsHandler {
    private static instance;
    private constructor();
    static getInstance(): DiagnosticsHandler;
    openFiles(paths: string[], loadDiagnostics: boolean): Promise<void>;
    getDiagnostics(paths: string[]): Promise<{
        key: string;
        errorString: string | null;
    }[]>;
    private formatDiagnostics;
}
