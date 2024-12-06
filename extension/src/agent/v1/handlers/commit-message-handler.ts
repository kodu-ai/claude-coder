import { GitLogItem } from "../../../shared/ExtensionMessage"

export class CommitMessageHandler {
    private static readonly COMMIT_TYPES = [
        'fix',     // Bug fixes
        'feat',    // New features
        'build',   // Build system or external dependencies
        'chore',   // Maintenance tasks
        'ci',      // CI configuration
        'docs',    // Documentation
        'style',   // Code style/formatting
        'refactor',// Code refactoring
        'perf',    // Performance improvements
        'test'     // Tests
    ]

    /**
     * Generates a conventional commit message based on the provided changes
     * @param changes Array of file changes with their content
     * @returns A formatted commit message following conventional commits specification
     */
    static generateCommitMessage(changes: Array<{ path: string, content: string }>): string {
        const type = this.determineCommitType(changes)
        const description = this.generateDescription(changes)
        
        // Ensure message follows conventional commit format and length constraints
        const message = `${type}: ${description}`
        return message.length > 72 ? message.substring(0, 69) + '...' : message
    }

    /**
     * Determines the appropriate commit type based on the changes
     * @param changes Array of file changes to analyze
     * @returns The most appropriate commit type
     */
    private static determineCommitType(changes: Array<{ path: string, content: string }>): string {
        // Default to 'chore' if no specific type can be determined
        let commitType = 'chore'

        for (const change of changes) {
            const { path, content } = change

            // Check for test files
            if (path.includes('test') || path.includes('spec')) {
                commitType = 'test'
                continue
            }

            // Check for documentation
            if (path.includes('docs') || path.includes('README') || path.includes('.md')) {
                commitType = 'docs'
                continue
            }

            // Check content for specific patterns
            if (this.containsNewFeature(content)) {
                return 'feat' // New feature takes precedence
            }

            if (this.containsBugFix(content)) {
                commitType = 'fix'
                continue
            }

            if (this.containsRefactor(content)) {
                commitType = 'refactor'
                continue
            }

            // Check for build related changes
            if (path.includes('package.json') || path.includes('webpack') || path.includes('tsconfig')) {
                commitType = 'build'
                continue
            }
        }

        return commitType
    }

    /**
     * Generates a descriptive message based on the changes
     * @param changes Array of file changes to analyze
     * @returns A concise description of the changes
     */
    private static generateDescription(changes: Array<{ path: string, content: string }>): string {
        // If only one file changed, use its name in the description
        if (changes.length === 1) {
            const fileName = changes[0].path.split('/').pop() || ''
            return `update ${fileName}`
        }

        // For multiple files, create a summary
        const affectedComponents = new Set(
            changes.map(change => {
                const parts = change.path.split('/')
                return parts[parts.length - 2] || parts[parts.length - 1]
            })
        )

        if (affectedComponents.size === 1) {
            return `update ${Array.from(affectedComponents)[0]}`
        }

        return `update multiple components (${affectedComponents.size} files)`
    }

    /**
     * Checks if the content contains patterns indicating a new feature
     */
    private static containsNewFeature(content: string): boolean {
        const patterns = [
            'new',
            'add',
            'feature',
            'implement'
        ]
        return patterns.some(pattern => 
            content.toLowerCase().includes(pattern)
        )
    }

    /**
     * Checks if the content contains patterns indicating a bug fix
     */
    private static containsBugFix(content: string): boolean {
        const patterns = [
            'fix',
            'bug',
            'issue',
            'error',
            'crash',
            'resolve'
        ]
        return patterns.some(pattern => 
            content.toLowerCase().includes(pattern)
        )
    }

    /**
     * Checks if the content contains patterns indicating a refactor
     */
    private static containsRefactor(content: string): boolean {
        const patterns = [
            'refactor',
            'restructure',
            'reorganize',
            'cleanup',
            'improve'
        ]
        return patterns.some(pattern => 
            content.toLowerCase().includes(pattern)
        )
    }
}