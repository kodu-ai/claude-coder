export interface IGitHandler {
  init(dirAbsolutePath: string): Promise<void>;
  getStatus(): Promise<string>;
  commit(message: string): Promise<void>;
  push(): Promise<void>;
  // Add any other git-related methods as needed
}