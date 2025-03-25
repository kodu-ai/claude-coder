export class CodeDiffFormatter {
	/**
	 * Generates a truncated diff highlighting changes while preserving code structure.
	 * This implementation follows these key principles:
	 * 1. Always preserve class and function definitions for context
	 * 2. Show changes with surrounding lines for readability
	 * 3. Use ellipsis to indicate omitted unchanged code
	 * 4. Maintain proper indentation and structure
	 */
	public generateTruncatedDiff(
		originalCode: string,
		newCode: string,
		options: { language?: string; contextLines?: number } = {}
	): string {
		// Split both versions into lines for comparison
		const originalLines = originalCode.trim().split(/\r?\n/)
		const newLines = newCode.trim().split(/\r?\n/)
		const contextLines = options.contextLines ?? 5

		// Track changes and important structures
		const changedLineNumbers = this.findChangedLines(originalLines, newLines)
		const structuralLineNumbers = this.findStructuralLines(newLines, options.language)

		// Always include the entire file if it's small enough
		if (newLines.length <= contextLines * 4) {
			return newLines.join("\n")
		}

		// First, ensure we capture entire structural blocks
		const structuralBlocks = this.findStructuralBlocks(newLines, structuralLineNumbers)

		// Create regions around structural elements
		const structuralRegions = this.calculateStructuralRegions(
			structuralLineNumbers,
			structuralBlocks,
			newLines.length,
			contextLines
		)

		// Then, create regions around changes
		const changeRegions = this.calculateRegionsToShow(
			changedLineNumbers,
			new Set<number>(),
			newLines.length,
			contextLines
		)

		// Merge both types of regions
		const combinedRegions = this.mergeOverlappingRegions([...structuralRegions, ...changeRegions])

		// Build the final output
		return this.buildOutput(newLines, combinedRegions)
	}

	/**
	 * Identifies which lines have been changed between versions
	 */
	private findChangedLines(originalLines: string[], newLines: string[]): Set<number> {
		const changedLines = new Set<number>()

		// Mark added, removed, and modified lines
		for (let i = 0; i < Math.max(originalLines.length, newLines.length); i++) {
			if (i >= originalLines.length || i >= newLines.length || originalLines[i].trim() !== newLines[i].trim()) {
				changedLines.add(i)
			}
		}

		return changedLines
	}

	/**
	 * Identifies important structural elements like class/function definitions
	 */
	private findStructuralLines(lines: string[], language = "typescript"): Set<number> {
		const structuralLines = new Set<number>()

		// Language-specific patterns for top programming languages
		const languagePatterns: { [key: string]: RegExp[] } = {
			typescript: [
				/^\s*(export\s+)?(abstract\s+)?class\s+\w+/,
				/^\s*(public|private|protected|static)?\s*(async\s+)?[\w]+\s*\(/,
				/^\s*interface\s+\w+/,
				/^\s*enum\s+\w+/,
			],
			javascript: [
				/^\s*(export\s+)?class\s+\w+/,
				/^\s*(async\s+)?function\s*[\w]+\s*\(/,
				/^\s*const\s+\w+\s*=\s*\(\s*\)\s*=>/,
			],
			python: [
				/^\s*class\s+\w+(\s*\([^)]*\))?:/,
				/^\s*def\s+\w+\s*\([^)]*\):/,
				/^\s*async\s+def\s+\w+\s*\([^)]*\):/,
			],
			java: [
				/^\s*(public|private|protected)?\s*(abstract|final)?\s*class\s+\w+/,
				/^\s*(public|private|protected)?\s*(static)?\s*(final)?\s*\w+\s+\w+\s*\(/,
				/^\s*interface\s+\w+/,
				/^\s*enum\s+\w+/,
			],
			csharp: [
				/^\s*(public|private|protected|internal)?\s*(abstract|sealed)?\s*class\s+\w+/,
				/^\s*(public|private|protected|internal)?\s*(static|virtual|abstract|override)?\s*\w+\s+\w+\s*\(/,
				/^\s*interface\s+\w+/,
				/^\s*enum\s+\w+/,
			],
			cpp: [
				/^\s*(class|struct)\s+\w+/,
				/^\s*(public|private|protected):/,
				/^\s*(virtual|static)?\s*\w+\s+\w+\s*\([^)]*\)\s*(const)?\s*{?/,
				/^\s*namespace\s+\w+/,
			],
			php: [
				/^\s*(abstract\s+)?class\s+\w+/,
				/^\s*(public|private|protected)?\s*(static)?\s*function\s+\w+/,
				/^\s*interface\s+\w+/,
				/^\s*trait\s+\w+/,
			],
			ruby: [
				/^\s*class\s+\w+(\s*<\s*\w+)?/,
				/^\s*module\s+\w+/,
				/^\s*def\s+\w+/,
				/^\s*attr_(reader|writer|accessor)\s+:\w+/,
			],
			go: [/^\s*func\s+\w+\s*\([^)]*\)\s*[^{]*/, /^\s*type\s+\w+\s+(struct|interface)\s*{/, /^\s*package\s+\w+/],
			rust: [/^\s*fn\s+\w+/, /^\s*(pub\s+)?(struct|enum|trait|impl)\s+\w+/, /^\s*mod\s+\w+/],
		}

		// Get patterns for the specified language, fallback to typescript
		const patterns = languagePatterns[language.toLowerCase()] || languagePatterns.typescript

		// Track indentation levels and their corresponding structural elements
		const indentationMap = new Map<number, number>() // indentation -> line number

		// Find all structural elements and track their indentation
		lines.forEach((line, index) => {
			const indentation = line.search(/\S/)
			if (indentation >= 0) {
				// Check if this line matches any structural pattern
				if (patterns.some((pattern) => pattern.test(line))) {
					structuralLines.add(index)
					indentationMap.set(indentation, index)
				}

				// Also include closing braces/blocks at the same indentation level
				if (line.trim().match(/^[}]|^end$|^\)$|^];$|^};$/)) {
					const matchingOpen = indentationMap.get(indentation)
					if (matchingOpen !== undefined) {
						structuralLines.add(index)
					}
				}
			}
		})

		return structuralLines
	}

	/**
	 * Finds complete structural blocks (e.g. entire class/function definitions)
	 */
	private findStructuralBlocks(lines: string[], structuralLines: Set<number>): Array<{ start: number; end: number }> {
		const blocks: Array<{ start: number; end: number }> = []
		const sortedLines = Array.from(structuralLines).sort((a, b) => a - b)

		for (const line of sortedLines) {
			// Find the start of the block (include any preceding comments/decorators)
			let blockStart = line
			while (blockStart > 0) {
				const prevLine = lines[blockStart - 1].trim()
				if (prevLine.startsWith("@") || prevLine.startsWith("//") || prevLine.startsWith("/*")) {
					blockStart--
				} else {
					break
				}
			}

			// Find the end of the block by tracking indentation
			const baseIndent = lines[line].search(/\S/)
			let blockEnd = line

			for (let i = line + 1; i < lines.length; i++) {
				const currentIndent = lines[i].search(/\S/)
				if (currentIndent <= baseIndent && lines[i].trim().length > 0) {
					break
				}
				blockEnd = i
			}

			blocks.push({ start: blockStart, end: blockEnd })
		}

		return this.mergeOverlappingRegions(blocks)
	}

	/**
	 * Calculates regions around structural elements, ensuring entire blocks are preserved
	 */
	private calculateStructuralRegions(
		structuralLines: Set<number>,
		structuralBlocks: Array<{ start: number; end: number }>,
		totalLines: number,
		contextLines: number
	): Array<{ start: number; end: number }> {
		// Start with the structural blocks
		const regions = structuralBlocks.map((block) => ({
			start: Math.max(0, block.start - contextLines),
			end: Math.min(totalLines - 1, block.end + contextLines),
		}))

		// Add context around structural lines that aren't part of complete blocks
		const sortedLines = Array.from(structuralLines).sort((a, b) => a - b)
		for (const line of sortedLines) {
			const isInBlock = regions.some((region) => line >= region.start && line <= region.end)
			if (!isInBlock) {
				regions.push({
					start: Math.max(0, line - contextLines),
					end: Math.min(totalLines - 1, line + contextLines),
				})
			}
		}

		// Always include file start and end if we have any regions
		if (regions.length > 0) {
			// File start
			if (regions[0].start > contextLines) {
				regions.unshift({
					start: 0,
					end: Math.min(contextLines * 2, totalLines - 1),
				})
			}

			// File end
			if (regions[regions.length - 1].end < totalLines - contextLines) {
				regions.push({
					start: Math.max(0, totalLines - contextLines * 2),
					end: totalLines - 1,
				})
			}
		}

		return regions
	}

	/**
	 * Calculates regions around changed lines
	 */
	private calculateRegionsToShow(
		changedLines: Set<number>,
		structuralLines: Set<number>,
		totalLines: number,
		contextLines: number
	): Array<{ start: number; end: number }> {
		const regions: Array<{ start: number; end: number }> = []
		let currentRegion: { start: number; end: number } | null = null

		// Convert set to sorted array for easier processing
		const sortedLines = Array.from(changedLines).sort((a, b) => a - b)

		for (const line of sortedLines) {
			if (!currentRegion) {
				currentRegion = {
					start: Math.max(0, line - contextLines),
					end: Math.min(totalLines - 1, line + contextLines),
				}
			} else if (line <= currentRegion.end + contextLines) {
				// Extend current region if lines are close enough
				currentRegion.end = Math.min(totalLines - 1, line + contextLines)
			} else {
				// Start new region if lines are far apart
				regions.push(currentRegion)
				currentRegion = {
					start: Math.max(0, line - contextLines),
					end: Math.min(totalLines - 1, line + contextLines),
				}
			}
		}

		if (currentRegion) {
			regions.push(currentRegion)
		}

		return regions
	}

	/**
	 * Determines if a line should be included based on its proximity to important lines
	 */
	private isLineImportant(lineNumber: number, importantLines: Set<number>, contextLines: number): boolean {
		// Check the line itself and surrounding lines within context range
		for (let i = lineNumber - contextLines; i <= lineNumber + contextLines; i++) {
			if (importantLines.has(i)) {
				return true
			}
		}
		return false
	}

	/**
	 * Merges regions that overlap or are very close to each other
	 */
	private mergeOverlappingRegions(
		regions: Array<{ start: number; end: number }>
	): Array<{ start: number; end: number }> {
		if (regions.length <= 1) {
			return regions;
		}

		// Sort regions by start position
		regions.sort((a, b) => a.start - b.start)
		const merged: Array<{ start: number; end: number }> = [regions[0]]

		for (let i = 1; i < regions.length; i++) {
			const current = regions[i]
			const previous = merged[merged.length - 1]

			// Merge regions that overlap or are very close (within 8 lines)
			// Using a larger threshold to ensure better context preservation
			if (current.start <= previous.end + 8) {
				previous.end = Math.max(previous.end, current.end)
			} else {
				// Only add non-empty regions that are sufficiently large
				if (current.end - current.start > 2) {
					merged.push(current)
				}
			}
		}

		return merged
	}

	/**
	 * Builds the final output string with proper formatting and ellipsis
	 */
	private buildOutput(lines: string[], regions: Array<{ start: number; end: number }>): string {
		const output: string[] = []
		let lastEnd = -1

		// Sort regions by start position
		regions.sort((a, b) => a.start - b.start)

		for (const region of regions) {
			// Add ellipsis between non-contiguous regions
			if (lastEnd !== -1 && region.start > lastEnd + 1) {
				// Add indentation to ellipsis based on surrounding context
				const prevIndent = lines[lastEnd].match(/^\s*/)?.[0] || ""
				const nextIndent = lines[region.start].match(/^\s*/)?.[0] || ""
				const ellipsisIndent = prevIndent.length < nextIndent.length ? prevIndent : nextIndent
				output.push(ellipsisIndent + "...")
			}

			// Add the region's lines
			output.push(...lines.slice(region.start, region.end + 1))
			lastEnd = region.end
		}

		// Add final ellipsis if we didn't include the end
		if (lastEnd < lines.length - 1) {
			const lastIndent = lines[lastEnd].match(/^\s*/)?.[0] || ""
			output.push(lastIndent + "...")
		}

		return output.join("\n")
	}
}