/**
 *
 * @param filePath file path
 * @returns formatted file content with line numbers
 */
export declare const readFileAndFormat: (filePath: string) => Promise<string>;
/**
 * Convert file content to line-numbered text
 */
export declare const formatFileToLines: (content: string) => string;
export declare function extractTextFromFile(filePath: string): Promise<string>;
