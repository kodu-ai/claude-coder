/**
 * Detects potential AI-generated code omissions in the given file content.
 * Triggers if:
 *   - We find specific keywords/phrases indicating omitted code, OR
 *   - More than X% of the content is missing (by line count).
 *
 * NOTE: Omission cannot happen if the original file is empty at the start.
 *
 * @param originalFileContent The original content of the file.
 * @param newFileContent The new content of the file to check.
 * @returns An object containing whether an omission was detected and details about the detection.
 */
export declare function detectCodeOmission(originalFileContent: string, newFileContent: string): {
    hasOmission: boolean;
    details: {
        line?: string;
        keyword?: string;
        lineNumber?: number;
    }[];
};
