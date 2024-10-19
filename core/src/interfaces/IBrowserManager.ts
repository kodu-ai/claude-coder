/**
 * Represents the result of a browser operation, including a screenshot and console logs.
 */
export interface BrowserResult {
  screenshot: string | null;
  consoleLogs: string[];
}

/**
 * Manages browser operations for web interactions and testing.
 */
export interface IBrowserManager {
  /**
   * Launches a new browser instance.
   * @returns A promise that resolves when the browser is launched
   * @throws {Error} If the browser fails to launch
   */
  launchBrowser(): Promise<void>;

  /**
   * Closes the current browser instance.
   * @returns A promise that resolves when the browser is closed
   */
  closeBrowser(): Promise<void>;

  /**
   * Navigates to a specified URL.
   * @param url - The URL to navigate to
   * @returns A promise that resolves when navigation is complete
   * @throws {Error} If navigation fails
   */
  navigateTo(url: string): Promise<void>;

  /**
   * Captures a screenshot and console logs of the current page.
   * @returns A promise that resolves with the BrowserResult
   * @throws {Error} If capturing the screenshot or logs fails
   */
  captureScreenshotAndLogs(): Promise<BrowserResult>;

  /**
   * Executes a script in the context of the current page.
   * @param script - The script to execute
   * @returns A promise that resolves with the result of the script execution
   * @throws {Error} If script execution fails
   */
  executeScript<T>(script: string): Promise<T>;

  /**
   * Waits for a specified condition to be met on the page.
   * @param condition - A function that returns true when the condition is met
   * @param timeout - Maximum time to wait in milliseconds
   * @returns A promise that resolves when the condition is met
   * @throws {Error} If the condition is not met within the timeout period
   */
  waitForCondition(condition: () => boolean | Promise<boolean>, timeout: number): Promise<void>;

  /**
   * Checks if a browser instance is currently running.
   * @returns True if a browser instance is running, false otherwise
   */
  isBrowserRunning(): boolean;
}