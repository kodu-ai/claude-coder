export declare function findAndReplace(content: string, searchContent: string, replaceContent: string, startLine?: number): MatchResult;
export declare function performReplace(content: string, startLine: number, endLine: number, replaceContent: string): MatchResult;
export declare function findPerfectMatch(content: string, searchContent: string, startLine?: number): MatchResult;
export declare function findWhitespaceMatch(content: string, searchContent: string, startLine?: number): MatchResult;
export declare function findOneLinerMatch(content: string, searchContent: string, replaceContent: string, startLine?: number): MatchResult;
export declare function findTrailingMatch(content: string, searchContent: string, startLine?: number): MatchResult;
export declare function findDMPMatch(content: string, searchContent: string, startLine?: number): MatchResult;
export interface MatchResult {
    success: boolean;
    newContent?: string;
    lineStart?: number;
    lineEnd?: number;
    failureReason?: string;
}
export interface EditBlock {
    id: string;
    searchContent: string;
    currentContent: string;
    finalContent?: string;
    status: "pending" | "streaming" | "final";
    matchedLocation?: {
        lineStart: number;
        lineEnd: number;
    };
    dmpAttempted?: boolean;
}
export interface BlockResult {
    id: string;
    searchContent: string;
    replaceContent: string;
    wasApplied: boolean;
    failureReason?: string;
    lineStart?: number;
    lineEnd?: number;
    formattedSavedArea?: string;
}
