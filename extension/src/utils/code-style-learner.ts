/**
 * CodeStyleLearner class analyzes and learns from user's code style preferences
 * to maintain consistent coding patterns.
 */
export class CodeStyleLearner {
    private stylePatterns: StylePatterns = {
        indentation: {
            type: 'spaces',
            size: 4
        },
        naming: {
            variables: 'camelCase',
            functions: 'camelCase',
            classes: 'PascalCase',
            constants: 'UPPER_SNAKE'
        },
        formatting: {
            lineEnding: '\n',
            maxLineLength: 120,
            semicolons: true,
            quotes: 'single'
        },
        spacing: {
            beforeBlocks: true,
            afterCommas: true,
            aroundOperators: true
        }
    }

    private sampleSize: number = 0
    private confidenceScores: ConfidenceScores = this.initializeConfidenceScores()

    /**
     * Analyzes a code sample to learn style patterns
     * @param code The code sample to analyze
     */
    public learnFromCode(code: string): void {
        this.sampleSize++
        
        // Analyze indentation
        this.analyzeIndentation(code)
        
        // Analyze naming conventions
        this.analyzeNamingConventions(code)
        
        // Analyze formatting
        this.analyzeFormatting(code)
        
        // Analyze spacing
        this.analyzeSpacing(code)
        
        // Update confidence scores
        this.updateConfidenceScores()
    }

    /**
     * Returns the learned style patterns with confidence scores
     */
    public getStylePatterns(): StylePatternsWithConfidence {
        return {
            patterns: this.stylePatterns,
            confidence: this.confidenceScores,
            sampleSize: this.sampleSize
        }
    }

    /**
     * Analyzes code indentation patterns
     */
    private analyzeIndentation(code: string): void {
        const lines = code.split('\n')
        let spacesCount = 0
        let tabsCount = 0

        for (const line of lines) {
            const indentMatch = line.match(/^[\t ]+/)
            if (indentMatch) {
                const indent = indentMatch[0]
                if (indent.includes('\t')) {
                    tabsCount++
                } else {
                    spacesCount++
                    // Update most common space count
                    const spaceSize = indent.length
                    if (spaceSize % 2 === 0 || spaceSize % 4 === 0) {
                        this.stylePatterns.indentation.size = 
                            spaceSize > 8 ? Math.min(spaceSize, 4) : spaceSize
                    }
                }
            }
        }

        this.stylePatterns.indentation.type = 
            tabsCount > spacesCount ? 'tabs' : 'spaces'
    }

    /**
     * Analyzes naming conventions in code
     */
    private analyzeNamingConventions(code: string): void {
        // Variable declarations
        const varRegex = /(?:let|const|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=/g
        let match
        while ((match = varRegex.exec(code)) !== null) {
            const name = match[1]
            this.updateNamingPattern('variables', this.detectNamingStyle(name))
        }

        // Function declarations
        const funcRegex = /function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g
        while ((match = funcRegex.exec(code)) !== null) {
            const name = match[1]
            this.updateNamingPattern('functions', this.detectNamingStyle(name))
        }

        // Class declarations
        const classRegex = /class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g
        while ((match = classRegex.exec(code)) !== null) {
            const name = match[1]
            this.updateNamingPattern('classes', this.detectNamingStyle(name))
        }
    }

    /**
     * Analyzes code formatting patterns
     */
    private analyzeFormatting(code: string): void {
        // Detect line ending
        this.stylePatterns.formatting.lineEnding = 
            code.includes('\r\n') ? '\r\n' : '\n'

        // Detect max line length
        const lines = code.split(/\r?\n/)
        const maxLength = Math.max(...lines.map(line => line.length))
        if (maxLength > 0) {
            this.stylePatterns.formatting.maxLineLength = 
                maxLength > 200 ? 120 : maxLength
        }

        // Detect semicolon usage
        const statements = code.split(/[;\n]/)
        let semicolonCount = 0
        let noSemicolonCount = 0
        for (const stmt of statements) {
            if (stmt.trim().endsWith(';')) {
                semicolonCount++
            } else if (stmt.trim().length > 0) {
                noSemicolonCount++
            }
        }
        this.stylePatterns.formatting.semicolons = 
            semicolonCount > noSemicolonCount

        // Detect quote style
        const singleQuotes = (code.match(/'/g) || []).length
        const doubleQuotes = (code.match(/"/g) || []).length
        this.stylePatterns.formatting.quotes = 
            singleQuotes >= doubleQuotes ? 'single' : 'double'
    }

    /**
     * Analyzes spacing patterns in code
     */
    private analyzeSpacing(code: string): void {
        // Check spacing before blocks
        const blockSpacingRegex = /\)\s*{/g
        const blockMatches = code.match(blockSpacingRegex)
        if (blockMatches) {
            this.stylePatterns.spacing.beforeBlocks = 
                blockMatches.some(m => m.includes(' '))
        }

        // Check spacing after commas
        const commaSpacingRegex = /,\s*/g
        const commaMatches = code.match(commaSpacingRegex)
        if (commaMatches) {
            this.stylePatterns.spacing.afterCommas = 
                commaMatches.some(m => m.includes(' '))
        }

        // Check spacing around operators
        const operatorSpacingRegex = /\s*[+\-*/%=!<>]\s*/g
        const operatorMatches = code.match(operatorSpacingRegex)
        if (operatorMatches) {
            this.stylePatterns.spacing.aroundOperators = 
                operatorMatches.some(m => m.includes(' '))
        }
    }

    /**
     * Detects the naming style of an identifier
     */
    private detectNamingStyle(name: string): NamingStyle {
        if (name.match(/^[A-Z][a-zA-Z0-9]*$/)) {
            return 'PascalCase'
        } else if (name.match(/^[a-z][a-zA-Z0-9]*$/)) {
            return 'camelCase'
        } else if (name.match(/^[A-Z][A-Z0-9_]*$/)) {
            return 'UPPER_SNAKE'
        } else if (name.match(/^[a-z][a-z0-9_]*$/)) {
            return 'snake_case'
        }
        return 'mixed'
    }

    /**
     * Updates naming pattern statistics
     */
    private updateNamingPattern(category: keyof typeof this.stylePatterns.naming, style: NamingStyle): void {
        if (style !== 'mixed') {
            this.stylePatterns.naming[category] = style
        }
    }

    /**
     * Initializes confidence scores for all style patterns
     */
    private initializeConfidenceScores(): ConfidenceScores {
        return {
            indentation: 0,
            naming: 0,
            formatting: 0,
            spacing: 0
        }
    }

    /**
     * Updates confidence scores based on sample size and consistency
     */
    private updateConfidenceScores(): void {
        // Simple confidence calculation based on sample size
        const maxConfidence = 1.0
        const samplesForMaxConfidence = 10
        
        const confidence = Math.min(
            this.sampleSize / samplesForMaxConfidence,
            maxConfidence
        )

        this.confidenceScores = {
            indentation: confidence,
            naming: confidence,
            formatting: confidence,
            spacing: confidence
        }
    }
}

/**
 * Types for style patterns
 */
interface StylePatterns {
    indentation: {
        type: 'spaces' | 'tabs'
        size: number
    }
    naming: {
        variables: NamingStyle
        functions: NamingStyle
        classes: NamingStyle
        constants: NamingStyle
    }
    formatting: {
        lineEnding: string
        maxLineLength: number
        semicolons: boolean
        quotes: 'single' | 'double'
    }
    spacing: {
        beforeBlocks: boolean
        afterCommas: boolean
        aroundOperators: boolean
    }
}

type NamingStyle = 'camelCase' | 'PascalCase' | 'snake_case' | 'UPPER_SNAKE' | 'mixed'

interface ConfidenceScores {
    indentation: number
    naming: number
    formatting: number
    spacing: number
}

interface StylePatternsWithConfidence {
    patterns: StylePatterns
    confidence: ConfidenceScores
    sampleSize: number
}