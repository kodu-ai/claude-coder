/**
 * Represents a terminal instance.
 */
export interface Terminal {
  id: number;
  busy: boolean;
  // Add other relevant properties
}

/**
 * Manages terminal operations within the application.
 */
export interface ITerminalManager {
  /**
   * Retrieves a list of terminals based on their busy state.
   * @param busy - If true, returns only busy terminals; if false, returns only non-busy terminals
   * @returns An array of Terminal objects
   */
  getTerminals(busy: boolean): Terminal[];

  /**
   * Checks if a process is currently running in the specified terminal.
   * @param id - The ID of the terminal to check
   * @returns True if the terminal is running a process, false otherwise
   */
  isProcessHot(id: number): boolean;

  /**
   * Retrieves any unretrieved output from the specified terminal.
   * @param id - The ID of the terminal to get output from
   * @returns The unretrieved output as a string, or undefined if there's no output
   */
  getUnretrievedOutput(id: number): string | undefined;

  /**
   * Disposes of all terminals managed by this terminal manager.
   */
  disposeAll(): void;

  /**
   * Creates a new terminal instance.
   * @param name - Optional name for the new terminal
   * @returns The ID of the newly created terminal
   */
  createTerminal(name?: string): number;

  /**
   * Sends a command to a specific terminal.
   * @param id - The ID of the terminal to send the command to
   * @param command - The command to send
   * @returns A promise that resolves when the command has been sent
   */
  sendCommand(id: number, command: string): Promise<void>;

  /**
   * Kills the process running in a specific terminal.
   * @param id - The ID of the terminal to kill the process in
   * @returns A promise that resolves when the process has been killed
   */
  killProcess(id: number): Promise<void>;
}