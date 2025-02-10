declare global {
    interface String {
        toPosix(): string;
    }
}
export declare function arePathsEqual(path1?: string, path2?: string): boolean;
/**
 * Helper function to check if a path exists.
 *
 * @param path - The path to check.
 * @returns A promise that resolves to true if the path exists, false otherwise.
 */
export declare function fileExistsAtPath(filePath: string): Promise<boolean>;
