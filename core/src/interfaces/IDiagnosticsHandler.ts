export interface IDiagnosticsHandler {
  init(dirAbsolutePath: string): void;
  getProblemsString(rootPath: string): string | undefined;
  // Add other diagnostics-related methods as needed
}