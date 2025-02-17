/**
 * Data structure for each diff block (HEAD vs updated).
 */
export interface EditBlock {
    id: string;
    path: string;
    searchContent: string;
    replaceContent: string;
    isDelete?: boolean;
    isFinalized?: boolean;
}
export declare const SEARCH_HEAD: "<<<<<<< HEAD";
export declare const SEPARATOR: "=======";
export declare const REPLACE_HEAD: ">>>>>>> updated";
/**
 * Manage partial diff blocks, parse them, merge them, and generate stable IDs.
 */
export declare class DiffBlockManager {
    private _blocks;
    get blocks(): EditBlock[];
    /**
     * Return the "last" block we appended or updated, if any.
     * (You may or may not need this, depending on how you track partial streaming.)
     */
    getLastBlock(): EditBlock | undefined;
    /**
     * Parse new diff content, create or update blocks,
     * and return the blocks that were newly discovered from this parse operation.
     */
    parseAndMergeDiff(diffContent: string, filePath: string): EditBlock[];
    /**
     * If you need to do a final pass over all blocks once the streaming is complete.
     */
    finalizeAllBlocks(): void;
    /**
     * Actually parse the raw diff content and produce EditBlock objects.
     */
    parseDiffBlocks(diffContent: string, filePath: string): EditBlock[];
}
export declare function normalize(text: string): string;
export declare function checkFileExists(relPath: string): Promise<boolean>;
export declare function preprocessContent(content: string): string;
