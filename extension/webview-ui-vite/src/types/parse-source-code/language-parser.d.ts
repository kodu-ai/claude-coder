import Parser from "web-tree-sitter";
export interface LanguageParser {
    [key: string]: {
        parser: Parser;
        query: Parser.Query;
    };
}
export declare function loadRequiredLanguageParsers(filesToParse: string[]): Promise<LanguageParser>;
