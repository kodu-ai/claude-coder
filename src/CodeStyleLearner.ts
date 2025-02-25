interface StylePatterns {
    indentation: {
        type: 'spaces' | 'tabs';
        size: number;
    };
    naming: {
        variables: string;
        functions: string;
        classes: string;
        constants: string;
    };
    formatting: {
        lineEnding: 'LF' | 'CRLF';
        maxLineLength: number;
        semicolons: boolean;
        quotes: 'single' | 'double';
    };
    spacing: {
        aroundOperators: boolean;
        afterComma: boolean;
        aroundBlocks: boolean;
    };
}

interface ConfidenceScores {
    indentation: number;
    naming: number;
    formatting: number;
    spacing: number;
}

export class CodeStyleLearner {
    private patterns: StylePatterns;
    private confidence: ConfidenceScores;
    private sampleSize: number;

    constructor() {
        this.patterns = {
            indentation: { type: 'spaces', size: 4 },
            naming: {
                variables: 'camelCase',
                functions: 'camelCase',
                classes: 'PascalCase',
                constants: 'UPPER_SNAKE_CASE'
            },
            formatting: {
                lineEnding: 'LF',
                maxLineLength: 80,
                semicolons: true,
                quotes: 'single'
            },
            spacing: {
                aroundOperators: true,
                afterComma: true,
                aroundBlocks: true
            }
        };

        this.confidence = {
            indentation: 0,
            naming: 0,
            formatting: 0,
            spacing: 0
        };

        this.sampleSize = 0;
    }

    public learnFromCode(code: string): void {
        if (!code || typeof code !== 'string') {
            throw new Error('Invalid code sample provided');
        }

        this.sampleSize++;
        
        this.analyzeIndentation(code);
        this.analyzeNaming(code);
        this.analyzeFormatting(code);
        this.analyzeSpacing(code);
        
        this.updateConfidenceScores();
    }

    public getStylePatterns(): { patterns: StylePatterns; confidence: ConfidenceScores; sampleSize: number } {
        return {
            patterns: { ...this.patterns },
            confidence: { ...this.confidence },
            sampleSize: this.sampleSize
        };
    }

    private analyzeIndentation(code: string): void {
        const lines = code.split('\n');
        let spacesCount = 0;
        let tabsCount = 0;
        let indentSizes = new Map<number, number>();

        for (const line of lines) {
            const indentMatch = line.match(/^[\t ]*/)[0];
            if (indentMatch) {
                if (indentMatch.includes('\t')) {
                    tabsCount++;
                } else {
                    spacesCount++;
                    const size = indentMatch.length;
                    if (size > 0) {
                        indentSizes.set(size, (indentSizes.get(size) || 0) + 1);
                    }
                }
            }
        }

        // Determine indentation type
        if (spacesCount > tabsCount) {
            this.patterns.indentation.type = 'spaces';
            // Find most common indent size
            let maxCount = 0;
            let mostCommonSize = 4; // default
            for (const [size, count] of indentSizes.entries()) {
                if (count > maxCount) {
                    maxCount = count;
                    mostCommonSize = size;
                }
            }
            this.patterns.indentation.size = mostCommonSize;
        } else if (tabsCount > 0) {
            this.patterns.indentation.type = 'tabs';
            this.patterns.indentation.size = 1;
        }
    }

    private analyzeNaming(code: string): void {
        // Variable and function declarations
        const varRegex = /(?:let|const|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
        const funcRegex = /function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
        const classRegex = /class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
        const constRegex = /const\s+([A-Z_$][A-Z0-9_$]*)/g;

        let varStyle = this.analyzeNamingPattern(Array.from(code.matchAll(varRegex), m => m[1]));
        let funcStyle = this.analyzeNamingPattern(Array.from(code.matchAll(funcRegex), m => m[1]));
        let classStyle = this.analyzeNamingPattern(Array.from(code.matchAll(classRegex), m => m[1]));
        let constStyle = this.analyzeNamingPattern(Array.from(code.matchAll(constRegex), m => m[1]));

        if (varStyle) this.patterns.naming.variables = varStyle;
        if (funcStyle) this.patterns.naming.functions = funcStyle;
        if (classStyle) this.patterns.naming.classes = classStyle;
        if (constStyle) this.patterns.naming.constants = constStyle;
    }

    private analyzeNamingPattern(identifiers: string[]): string {
        if (identifiers.length === 0) return null;

        let camelCase = 0;
        let pascalCase = 0;
        let upperSnakeCase = 0;

        for (const id of identifiers) {
            if (/^[A-Z][a-zA-Z0-9]*$/.test(id)) {
                pascalCase++;
            } else if (/^[a-z][a-zA-Z0-9]*$/.test(id)) {
                camelCase++;
            } else if (/^[A-Z][A-Z0-9_]*$/.test(id)) {
                upperSnakeCase++;
            }
        }

        const max = Math.max(camelCase, pascalCase, upperSnakeCase);
        if (max === camelCase) return 'camelCase';
        if (max === pascalCase) return 'PascalCase';
        if (max === upperSnakeCase) return 'UPPER_SNAKE_CASE';
        return null;
    }

    private analyzeFormatting(code: string): void {
        // Line ending analysis
        const crlfCount = (code.match(/\r\n/g) || []).length;
        const lfCount = (code.match(/[^\r]\n/g) || []).length;
        this.patterns.formatting.lineEnding = crlfCount > lfCount ? 'CRLF' : 'LF';

        // Line length analysis
        const lines = code.split('\n');
        let maxLength = 0;
        for (const line of lines) {
            maxLength = Math.max(maxLength, line.length);
        }
        this.patterns.formatting.maxLineLength = maxLength;

        // Semicolon analysis
        const statementsWithSemicolon = (code.match(/;\s*(\n|$)/g) || []).length;
        const statementsWithoutSemicolon = (code.match(/[^;]\s*(\n|$)/g) || []).length;
        this.patterns.formatting.semicolons = statementsWithSemicolon > statementsWithoutSemicolon;

        // Quote analysis
        const singleQuotes = (code.match(/'/g) || []).length;
        const doubleQuotes = (code.match(/"/g) || []).length;
        this.patterns.formatting.quotes = singleQuotes > doubleQuotes ? 'single' : 'double';
    }

    private analyzeSpacing(code: string): void {
        // Operator spacing
        const operatorsWithSpace = (code.match(/\s[+\-*/%=<>!&|]\s/g) || []).length;
        const operatorsWithoutSpace = (code.match(/[^+\-*/%=<>!&|][+\-*/%=<>!&|][^+\-*/%=<>!&|]/g) || []).length;
        this.patterns.spacing.aroundOperators = operatorsWithSpace > operatorsWithoutSpace;

        // Comma spacing
        const commasWithSpace = (code.match(/,\s/g) || []).length;
        const commasWithoutSpace = (code.match(/,[^\s]/g) || []).length;
        this.patterns.spacing.afterComma = commasWithSpace > commasWithoutSpace;

        // Block spacing
        const blocksWithSpace = (code.match(/\{\s|\s\}/g) || []).length;
        const blocksWithoutSpace = (code.match(/\{[^\s]|[^\s]\}/g) || []).length;
        this.patterns.spacing.aroundBlocks = blocksWithSpace > blocksWithoutSpace;
    }

    private updateConfidenceScores(): void {
        const baseConfidence = Math.min(this.sampleSize * 0.1, 1);
        
        this.confidence.indentation = baseConfidence;
        this.confidence.naming = baseConfidence;
        this.confidence.formatting = baseConfidence;
        this.confidence.spacing = baseConfidence;
    }
}