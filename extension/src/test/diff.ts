import * as fs from "fs/promises"
import { diffLines } from "diff"

async function createFileDiff(file1Path: string, file2Path: string): Promise<string> {
	try {
		// Read both files asynchronously
		const [content1, content2] = await Promise.all([fs.readFile(file1Path, "utf8"), fs.readFile(file2Path, "utf8")])

		// Generate diff
		const differences = diffLines(content1, content2)

		// Format the output
		let diffOutput = ""

		differences.forEach((part) => {
			// Add appropriate prefix based on the type of change
			const prefix = part.added ? "+" : part.removed ? "-" : " "

			// Split the text into lines and add prefix to each line
			const lines = part.value
				.split("\n")
				.filter((line) => line.length > 0) // Remove empty lines
				.map((line) => `${prefix} ${line}`)
				.join("\n")

			diffOutput += lines + "\n"
		})

		return diffOutput
	} catch (error) {
		throw new Error(`Error creating diff: ${error.message}`)
	}
}

// Example usage
async function example() {
	try {
		const here = __dirname
		const path1 = here + "/opt1.txt"
		const path2 = here + "/opt2.txt"
		const diff = await createFileDiff(path1, path2)
		console.log("File differences:")
		console.log(diff)
	} catch (error) {
		console.error(error)
	}
}

example()
