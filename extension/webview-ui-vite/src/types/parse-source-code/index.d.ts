export declare const LIST_FILES_LIMIT = 200;
export declare function parseSourceCodeForDefinitionsTopLevel(dirPath: string): Promise<string>;
export declare function listFiles(dirPath: string, recursive: boolean, limit: number): Promise<[string[], boolean]>;
