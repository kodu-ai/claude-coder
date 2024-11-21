import * as childProcess from "child_process"
import * as fs from "fs"
import * as path from "path"
import * as readline from "readline"
import * as vscode from "vscode"

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

Usage example:
const results = await regexSearchFiles('/path/to/cwd', '/path/to/search', 'TODO:', '*.ts');

rel/path/to/app.ts
│----
│function processData(data: any) {
│  // Some processing logic here
│  // TODO: Implement error handling
│  return processedData;
│}
│----

rel/path/to/helper.ts
│----
│  let result = 0;
│  for (let i = 0; i < input; i++) {
│    // TODO: Optimize this function for performance
│    result += Math.pow(i, 2);
│  }
│----
*/

const isWindows = /^win/.test(process.platform)
const binName = isWindows ? "rg.exe" : "rg"

interface SearchResult {
	file: string
	line: number
	column: number
	match: string
	beforeContext: string[]
	afterContext: string[]
}

const MAX_RESULTS = 300
const MAX_OUTPUT_SIZE = 100000 // 100KB limit for total output

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
			crlfDelay: Infinity, // treat \r\n as a single line break even if it's split across chunks. This ensures consistent behavior across different operating systems.
		})

		let output = ""
		let lineCount = 0
		const maxLines = MAX_RESULTS * 5

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

	// Default to common source code files if no pattern specified
	const defaultPattern = "*.{js,jsx,ts,tsx,py,java,c,cpp,h,hpp,go,rs,php,rb,swift,kt}"

	const args = [
		"--json",
		"-e", regex,
		"--glob", filePattern || defaultPattern,
		"--context", "1",
		"--max-columns", "300",
		directoryPath
	]

	let output: string
	try {
		output = await execRipgrep(rgPath, args)
	} catch (error) {
		console.error("Ripgrep error:", error)
		return "No results found"
	}

	const results: SearchResult[] = []
	let currentResult: Partial<SearchResult> | null = null
	let totalSize = 0

	for (const line of output.split("\n")) {
		if (!line) continue
		
		try {
			const parsed = JSON.parse(line)
			totalSize += line.length

			if (totalSize > MAX_OUTPUT_SIZE) {
				throw new Error("Search results exceed maximum allowed size. Please use a more specific search pattern or make sure to specify a specific path in order to avoid hits on dependencies (node_modules, etc.).")
			}

			if (parsed.type === "match") {
				if (currentResult) {
					results.push(currentResult as SearchResult)
				}
				
				if (results.length >= MAX_RESULTS) {
					throw new Error(`Got ${results.length} results. Please use a more specific search pattern or make sure to specify a specific path in order to avoid hits on dependencies (node_modules, etc.).`)
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
			if (error instanceof Error && (error.message.includes("exceed maximum allowed size") || 
				error.message.includes("Too many search results"))) {
				throw error
			}
			console.error("Error parsing ripgrep output:", error)
		}
	}

	if (currentResult) {
		results.push(currentResult as SearchResult)
	}

	return formatResults(results, cwd)
}

function formatResults(results: SearchResult[], cwd: string): string {
	const groupedResults: { [key: string]: SearchResult[] } = {}

	let output = ""
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

	for (const [filePath, fileResults] of Object.entries(groupedResults)) {
		output += `${filePath}\n│----\n`

		fileResults.forEach((result, index) => {
			const allLines = [...result.beforeContext, result.match, ...result.afterContext]
			allLines.forEach((line) => {
				output += `│${line?.trimEnd() ?? ""}\n`
			})

			if (index < fileResults.length - 1) {
				output += "│----\n"
			}
		})

		output += "│----\n\n"
	}

	return output.trim()
}
