/**
 * Represents an API provider with methods for making API calls.
 */
export interface IApiProvider {
  // Add methods as needed, for example:
  // makeRequest(endpoint: string, data: any): Promise<any>;
}

/**
 * Manages API-related operations and configurations.
 */
export interface IApiManager {
  /**
   * Retrieves the API key.
   * @returns The API key as a string.
   */
  getApiKey(): string;

  /**
   * Retrieves the API URL.
   * @returns The API URL as a string.
   */
  getApiUrl(): string;

  /**
   * Retrieves custom instructions for API usage.
   * @returns Custom instructions as a string.
   */
  getCustomInstructions(): string;

  /**
   * Retrieves the API provider instance.
   * @returns An instance of IApiProvider.
   */
  getProvider(): IApiProvider;
}