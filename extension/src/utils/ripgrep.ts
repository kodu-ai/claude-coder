import * as vscode from "vscode"
import * as childProcess from "child_process"
import * as path from "path"
import * as fs from "fs"
import * as readline from "readline"

/*
This file provides functionality to perform regex searches on files using ripgrep.
Inspired by: https://github.com/DiscreteTom/vscode-ripgrep-utils

Key components:
1. getBinPath: Locates the ripgrep binary within the VSCode installation.
2. execRipgrep: Executes the ripgrep command and returns the output.
3. regexSearchFiles: The main function that performs regex searches on files.
   - Parameters:
     * cwd: The current working directory (for relative path calculation)
     * directoryPath: The directory to search in
     * regex: The regular expression to search for (Rust regex syntax)
     * filePattern: Optional glob pattern to filter files (default: '*')
   - Returns: A formatted string containing search results with context

The search results include:
- Relative file paths
- 2 lines of context before and after each match
- Matches formatted with pipe characters for easy reading
*/

const isWindows = /^win/.test(process.platform)
const binName = isWindows ? "rg.exe" : "rg"
const MAX_RESULTS = 300

/**
 * Directories to exclude for many common project types. You can add more if needed.
 */
const EXCLUDES = [
	"node_modules",
	".git",
	".hg",
	".svn",
	"dist",
	"build",
	"out",
	"__pycache__",
	"target",
	"bin",
	"obj",
	".venv",
]

async function getBinPath(vscodeAppRoot: string): Promise<string | undefined> {
	const checkPath = async (pkgFolder: string) => {
		const fullPath = path.join(vscodeAppRoot, pkgFolder, binName)
		return (await pathExists(fullPath)) ? fullPath : undefined
	}

	return (
		(await checkPath("node_modules/@vscode/ripgrep/bin/")) ||
		(await checkPath("node_modules/vscode-ripgrep/bin")) ||
		(await checkPath("node_modules.asar.unpacked/vscode-ripgrep/bin/")) ||
		(await checkPath("node_modules.asar.unpacked/@vscode/ripgrep/bin/"))
	)
}

async function pathExists(path: string): Promise<boolean> {
	return new Promise((resolve) => {
		fs.access(path, (err) => {
			resolve(err === null)
		})
	})
}

async function execRipgrep(bin: string, args: string[]): Promise<string> {
	return new Promise((resolve, reject) => {
		const rgProcess = childProcess.spawn(bin, args)
		// cross-platform alternative to head, which is ripgrep author's recommendation for limiting output.
		const rl = readline.createInterface({
			input: rgProcess.stdout,
			crlfDelay: Infinity, // treat \r\n as a single line break
		})

		let output = ""
		let lineCount = 0
		const maxLines = MAX_RESULTS * 5 // limiting lines read

		rl.on("line", (line) => {
			if (lineCount < maxLines) {
				output += line + "\n"
				lineCount++
			} else {
				rl.close()
				rgProcess.kill()
			}
		})

		let errorOutput = ""
		rgProcess.stderr.on("data", (data) => {
			errorOutput += data.toString()
		})
		rl.on("close", () => {
			if (errorOutput) {
				reject(new Error(`ripgrep process error: ${errorOutput}`))
			} else {
				resolve(output)
			}
		})
		rgProcess.on("error", (error) => {
			reject(new Error(`ripgrep process error: ${error.message}`))
		})
	})
}

interface SearchResult {
	file: string
	line: number
	column: number
	match: string
	beforeContext: string[]
	afterContext: string[]
}

export async function regexSearchFiles(
	cwd: string,
	directoryPath: string,
	regex: string,
	filePattern?: string
): Promise<string> {
	const vscodeAppRoot = vscode.env.appRoot
	const rgPath = await getBinPath(vscodeAppRoot)

	if (!rgPath) {
		throw new Error("Could not find ripgrep binary")
	}

	// Build the ripgrep arguments
	const args = ["--json", "-e", regex, "--context", "1"]

	// If the caller provided a file pattern, add it. Otherwise default to '*'.
	args.push("--glob", filePattern || "*")

	// Add the exclude globs (e.g., `--glob '!node_modules'`)
	EXCLUDES.forEach((exclude) => {
		args.push("--glob", `!${exclude}`)
	})

	// Finally, add the directory path to search
	args.push(directoryPath)

	let output: string
	try {
		output = await execRipgrep(rgPath, args)
	} catch {
		return "No results found"
	}

	const results: SearchResult[] = []
	let currentResult: Partial<SearchResult> | null = null

	output.split("\n").forEach((line) => {
		if (line) {
			try {
				const parsed = JSON.parse(line)
				if (parsed.type === "match") {
					// Push the previous result if any
					if (currentResult) {
						results.push(currentResult as SearchResult)
					}
					currentResult = {
						file: parsed.data.path.text,
						line: parsed.data.line_number,
						column: parsed.data.submatches[0].start,
						match: parsed.data.lines.text,
						beforeContext: [],
						afterContext: [],
					}
				} else if (parsed.type === "context" && currentResult) {
					if (parsed.data.line_number < currentResult.line!) {
						currentResult.beforeContext!.push(parsed.data.lines.text)
					} else {
						currentResult.afterContext!.push(parsed.data.lines.text)
					}
				}
			} catch (error) {
				console.error("Error parsing ripgrep output:", error)
			}
		}
	})

	// Push the last buffered result
	if (currentResult) {
		results.push(currentResult as SearchResult)
	}

	return formatResults(results, cwd)
}

/**
 * Formats the final output, grouping by file and limiting total output to MAX_OUTPUT_CHARS.
 */
function formatResults(results: SearchResult[], cwd: string): string {
	// Adjust this limit as needed
	const MAX_OUTPUT_CHARS = 100_000

	const groupedResults: { [key: string]: SearchResult[] } = {}
	let output = ""

	// Indicate how many results we found (or if we only show partial)
	if (results.length >= MAX_RESULTS) {
		output += `Showing first ${MAX_RESULTS} of ${MAX_RESULTS}+ results. Use a more specific search if necessary.\n\n`
	} else {
		output += `Found ${results.length === 1 ? "1 result" : `${results.length.toLocaleString()} results`}.\n\n`
	}

	// Group results by file name
	results.slice(0, MAX_RESULTS).forEach((result) => {
		const relativeFilePath = path.relative(cwd, result.file)
		if (!groupedResults[relativeFilePath]) {
			groupedResults[relativeFilePath] = []
		}
		groupedResults[relativeFilePath].push(result)
	})

	// Track the size so we can truncate if needed
	let currentSize = output.length
	let shouldTruncate = false

	for (const [filePath, fileResults] of Object.entries(groupedResults)) {
		if (shouldTruncate) {
			break
		}

		const header = `${filePath}\n│----\n`
		if (currentSize + header.length >= MAX_OUTPUT_CHARS) {
			shouldTruncate = true
			break
		}
		output += header
		currentSize += header.length

		for (const [resultIndex, result] of fileResults.entries()) {
			if (shouldTruncate) {
				break
			}

			const allLines = [...result.beforeContext, result.match, ...result.afterContext]

			for (const line of allLines) {
				const formattedLine = `│${line?.trimEnd() ?? ""}\n`
				if (currentSize + formattedLine.length >= MAX_OUTPUT_CHARS) {
					shouldTruncate = true
					break
				}
				output += formattedLine
				currentSize += formattedLine.length
			}

			if (shouldTruncate) {
				break
			}

			if (resultIndex < fileResults.length - 1) {
				const separator = "│----\n"
				if (currentSize + separator.length >= MAX_OUTPUT_CHARS) {
					shouldTruncate = true
					break
				}
				output += separator
				currentSize += separator.length
			}
		}

		if (shouldTruncate) {
			break
		}

		const footer = "│----\n\n"
		if (currentSize + footer.length >= MAX_OUTPUT_CHARS) {
			shouldTruncate = true
			break
		}
		output += footer
		currentSize += footer.length
	}

	if (shouldTruncate) {
		output += "\n[Truncated: The output exceeded the limit. Please refine your search.]\n"
	}

	return output.trim()
}
