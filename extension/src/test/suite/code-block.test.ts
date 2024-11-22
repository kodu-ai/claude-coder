import * as assert from "assert"
import { before, suite, test } from "mocha"
import {
	findCodeBlock,
	findSimilarLines,
	findBestBlockMatch,
	replaceIgnoringIndentation,
	adjustIndentationPerLine,
	parseDiffBlocks,
	EditBlock,
	applyEditBlocksToFile,
} from "../../agent/v1/tools/runners/coders/utils"
import { readFile } from "fs/promises"
import path from "path"

suite("Code Block - Sample1 test suite", () => {
	let block: string = ""
	let searchContent: string = ""
	let fileContent: string = ""
	let replaceContent: string = ""
	before(async () => {
		fileContent = await readFile(path.resolve(__dirname, "../../../../../src/test/suite/sample-1.ts"), "utf-8")
		replaceContent = `
    export function truncateHalfConversation(
    messages: Anthropic.Messages.MessageParam[]
    ): Anthropic.Messages.MessageParam[] {
    if (!Array.isArray(messages) || messages.length < MIN_MESSAGES_TO_KEEP) {
        return messages
    }
    
    // Always keep the first Task message (this includes the project's file structure in potentially_relevant_details)
    const firstMessage = messages[0]
    
    // Calculate how many message pairs to remove (must be even to maintain user-assistant order)
    const messagePairsToRemove = Math.max(1, Math.floor((messages.length - MIN_MESSAGES_TO_KEEP) / 4)) * 2
    
    // Keep the first message and the remaining messages after truncation
    const remainingMessages = messages.slice(messagePairsToRemove + 1)
    
    // Count occurrences of first message in original messages array
    const firstMessageCount = messages.filter(msg => 
        JSON.stringify(msg.content) === JSON.stringify(firstMessage.content)
    ).length
    
    if (firstMessageCount >= 2) {
        // Remove last instance of first message from remaining messages
        const lastIndex = remainingMessages.findLastIndex(msg => 
            JSON.stringify(msg.content) === JSON.stringify(firstMessage.content)
        )
        if (lastIndex !== -1) {
            remainingMessages.splice(lastIndex, 1)
        }
    }
    
    // Always append first message at the end
    return [...remainingMessages, firstMessage]
    }
`
		searchContent = `
    export function truncateHalfConversation(
    messages: Anthropic.Messages.MessageParam[]
    ): Anthropic.Messages.MessageParam[] {
    if (!Array.isArray(messages) || messages.length < MIN_MESSAGES_TO_KEEP) {
        return messages
    }

    // Always keep the first Task message (this includes the project's file structure in potentially_relevant_details)
    const firstMessage = messages[0]

    // Calculate how many message pairs to remove (must be even to maintain user-assistant order)
    const messagePairsToRemove = Math.max(1, Math.floor((messages.length - MIN_MESSAGES_TO_KEEP) / 4)) * 2

    // Keep the first message and the remaining messages after truncation
    const remainingMessages = messages.slice(messagePairsToRemove + 1)

    // check if the first message exists appx twice if so pop the last instance and insert the first message again as last
    // if it doesn't exist twice, insert the first message as the last message

    return [firstMessage, ...remainingMessages]
}
`
		block = `
SEARCH
${searchContent}
=======
REPLACE
${replaceContent}`
	})
	test("parseDiffBlocks parses sample1 correctly", () => {
		const blocks = parseDiffBlocks(block, "sample-1.ts")
		assert.strictEqual(blocks.length, 1)
		assert.strictEqual(blocks[0].searchContent.trim(), searchContent.trim())
		assert.strictEqual(blocks[0].replaceContent.trim(), replaceContent.trim())
	})

	test("applyEditBlocksToFile correctly updates the content", async () => {
		const blocks = parseDiffBlocks(block, "sample-1.ts")
		const result = await applyEditBlocksToFile(fileContent, blocks)

		// Get the lines before the function in both original and result
		const originalLines = fileContent.split("\n")
		const resultLines = result.split("\n")
		const funcStartIndex = resultLines.findIndex((line) =>
			line.includes("export function truncateHalfConversation")
		)
		const originalFuncStartIndex = originalLines.findIndex((line) =>
			line.includes("export function truncateHalfConversation")
		)

		// Verify 5 lines before the function are identical
		for (let i = 1; i <= 5; i++) {
			const resultLine = resultLines[funcStartIndex - i]
			const originalLine = originalLines[originalFuncStartIndex - i]
			assert.strictEqual(resultLine, originalLine, `Line ${i} before function changed`)
		}

		// Verify the old implementation is gone
		assert.ok(!result.includes("return [firstMessage, ...remainingMessages]"))

		// Verify the new implementation is present
		assert.ok(result.includes("// Count occurrences of first message in original messages array"))
		assert.ok(result.includes("const firstMessageCount = messages.filter(msg =>"))
		assert.ok(result.includes("JSON.stringify(msg.content) === JSON.stringify(firstMessage.content)"))
		assert.ok(result.includes("return [...remainingMessages, firstMessage]"))

		// Verify indentation is preserved
		const indentedLine = resultLines.find((line) => line.includes("const firstMessageCount"))
		assert.ok(indentedLine?.startsWith("    "))

		// Verify the function structure is maintained
		assert.ok(result.includes("export function truncateHalfConversation("))
		assert.ok(result.includes("): Anthropic.Messages.MessageParam[] {"))

		// Verify the lines after the function are preserved
		const funcEndIndex = resultLines.findIndex((line) => line.includes("export function smartTruncation"))
		const originalFuncEndIndex = originalLines.findIndex((line) => line.includes("export function smartTruncation"))
		assert.strictEqual(funcEndIndex, originalFuncEndIndex, "Position of next function changed")
	})
})
suite("Code Block Utils Test Suite", () => {
	test("findCodeBlock finds simple code block", () => {
		const content = `
function test() {
    const x = 1;
    return x;
}
        `.trim()

		const result = findCodeBlock(content, 0)
		assert.ok(result)
		assert.strictEqual(result?.start, 0)
		assert.strictEqual(result?.end, 3)
	})

	test("findCodeBlock handles nested blocks", () => {
		const content = `
function outer() {
    if (true) {
        console.log('test');
    }
    return true;
}
        `.trim()

		const result = findCodeBlock(content, 0)
		assert.ok(result)
		assert.strictEqual(result?.start, 0)
		assert.strictEqual(result?.end, 5)
	})

	test("findCodeBlock returns null for invalid content", () => {
		const content = "const x = 1;" // No block
		const result = findCodeBlock(content, 0)
		assert.strictEqual(result, null)
	})

	test("findSimilarLines finds similar content above threshold", async () => {
		const search = `
    const x = 1;
    const y = 2;
        `.trim()

		const content = `
    // Some comment
    const x = 1;
    const y = 2;
    const z = 3;
        `.trim()

		const result = await findSimilarLines(search, content)
		assert.ok(result.includes("const x = 1"))
		assert.ok(result.includes("const y = 2"))
	})

	test("findSimilarLines returns empty for content below threshold", async () => {
		const search = "const x = 1;"
		const content = "let y = 2;"
		const result = await findSimilarLines(search, content)
		assert.strictEqual(result, "")
	})

	test("findBestBlockMatch finds exact matches", () => {
		const search = `
function test() {
    return true;
}
        `.trim()

		const content = `
// Some comment
function test() {
    return true;
}
// More code
        `.trim()

		const result = findBestBlockMatch(search, content)
		assert.ok(result)
		assert.ok(result?.score > 0.9) // Should be very high for exact match
	})

	test("findBestBlockMatch handles similar but not exact matches", () => {
		const search = `
function test() {
    return true;
}
        `.trim()

		const content = `
function test() {
    // Added comment
    return true;
}
        `.trim()

		const result = findBestBlockMatch(search, content)
		assert.ok(result)
		assert.ok(result?.score > 0.7) // Should still find a decent match
	})

	test("replaceIgnoringIndentation preserves indentation", () => {
		const content = `    function test() {
        return true;
    }`

		const search = `function test() {
    return true;
}`

		const replace = `function test() {
    console.log('test');
    return false;
}`

		const result = replaceIgnoringIndentation(content, search, replace)
		assert.ok(result)
		const lines = result.split("\n")

		// Use a helper to normalize whitespace and semicolons for comparison
		const normalize = (str: string) => str.replace(/;$/, "").replace(/\s+$/, "")
		assert.strictEqual(normalize(lines[0]), normalize("    function test() {"))
		assert.strictEqual(normalize(lines[1]), normalize("        console.log('test');"))
		assert.strictEqual(normalize(lines[2]), normalize("        return false;"))
		assert.strictEqual(normalize(lines[3]), normalize("    }"))
	})

	test("adjustIndentationPerLine handles nested blocks", () => {
		const contentLines = [
			"    function test() {",
			"        if (true) {",
			"            return true;",
			"        }",
			"    }",
		]

		const searchLines = ["function test() {", "    if (true) {", "        return true;", "    }", "}"]

		const replaceLines = [
			"function test() {",
			"    if (condition) {",
			'        console.log("test");',
			"        return false;",
			"    }",
			"}",
		]

		const result = adjustIndentationPerLine(contentLines, searchLines, replaceLines)
		const normalize = (str: string) => str.replace(/;$/, "").replace(/\s+$/, "")

		assert.strictEqual(normalize(result[0]), normalize("    function test() {"))
		assert.strictEqual(normalize(result[1]), normalize("        if (condition) {"))
		assert.strictEqual(normalize(result[2]), normalize('            console.log("test")'))
		assert.strictEqual(normalize(result[3]), normalize("            return false"))
		assert.strictEqual(normalize(result[4]), normalize("        }"))
		assert.strictEqual(normalize(result[5]), normalize("    }"))
	})

	test("adjustIndentationPerLine handles simple block with consistent indentation", () => {
		const contentLines = ["    function test() {", "        return true;", "    }"]

		const searchLines = ["function test() {", "    return true;", "}"]

		const replaceLines = ["function test() {", '    console.log("test");', "    return false;", "}"]

		const result = adjustIndentationPerLine(contentLines, searchLines, replaceLines)
		const normalize = (str: string) => str.replace(/;$/, "").replace(/\s+$/, "")

		assert.strictEqual(normalize(result[0]), normalize("    function test() {"))
		assert.strictEqual(normalize(result[1]), normalize('        console.log("test")'))
		assert.strictEqual(normalize(result[2]), normalize("        return false"))
		assert.strictEqual(normalize(result[3]), normalize("    }"))
	})

	test("parseDiffBlocks parses SEARCH/REPLACE blocks correctly", () => {
		const diffContent = `
SEARCH
function test() {
    return true;
}
=======
REPLACE
function test() {
    console.log('test');
    return false;
}

SEARCH
const x = 1;
=======
REPLACE
const x = 2;
        `.trim()

		const blocks = parseDiffBlocks(diffContent, "test.ts")
		assert.strictEqual(blocks.length, 2)
		assert.ok(blocks[0].searchContent.includes("function test()"))
		assert.ok(blocks[0].replaceContent.includes("console.log"))
		assert.strictEqual(blocks[1].searchContent, "const x = 1;")
		assert.strictEqual(blocks[1].replaceContent, "const x = 2;")
	})

	test("parseDiffBlocks handles delete operations", () => {
		const diffContent = `
SEARCH
function test() {
    return true;
}
=======
REPLACE
        `.trim()

		const blocks = parseDiffBlocks(diffContent, "test.ts")
		assert.strictEqual(blocks.length, 1)
		assert.ok(blocks[0].isDelete)
		assert.strictEqual(blocks[0].replaceContent, "")
	})
})
