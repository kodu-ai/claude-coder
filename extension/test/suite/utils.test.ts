import delay from "delay"
import {
	parseDiffBlocks,
	applyEditBlocksToFile,
	replaceIgnoringIndentation,
	adjustIndentationPerLine,
	EditBlock,
	preprocessContent,
} from "../../src/agent/v1/tools/runners/coders/utils"
import * as assert from "assert"

const block = `
SEARCH
    def add_tool_use(self, tool_name: str, parameters: Dict[str, Any], result: Any) -> None:
        """Add a tool use to the history."""
        # Log the tool use being added
        self.logger.info("=== Adding Tool Use to History ===")
        self.logger.info(f"Tool: {tool_name}")
        self.logger.info(f"Parameters: {parameters}")
        self.logger.info(f"Result: {result}")
        self.logger.info("==============================")
        
        self.history.append({
            'tool': tool_name,
            'parameters': parameters,
            'result': result
        })
=======
REPLACE
    def add_tool_use(self, tool_name: str, parameters: Dict[str, Any], result: Any) -> None:
        """Add a tool use to the history."""
        # Log the tool use being added
        self.logger.info("\n=== Tool Use Added to History ===")
        self.logger.info(f"Tool: {tool_name}")
        self.logger.info(f"Parameters: {parameters}")
        if hasattr(result, 'success'):
            self.logger.info(f"Success: {result.success}")
            self.logger.info(f"Message: {result.message if hasattr(result, 'message') else ''}")
            if hasattr(result, 'data') and result.data:
                self.logger.info(f"Data: {result.data}")
        else:
            self.logger.info(f"Result: {result}")
        self.logger.info("==============================\n")
        
        self.history.append({
            'tool': tool_name,
            'parameters': parameters,
            'result': result
        })`

describe("Edit Blocks Parser and Validator", () => {
	describe("parseDiffBlocks", () => {
		it("should parse single SEARCH/REPLACE block correctly", () => {
			const blocks = parseDiffBlocks(block, "test.py")
			assert.strictEqual(blocks.length, 1)
		})
		it("should parse single SEARCH/REPLACE block correctly", () => {
			const diffContent = `SEARCH
function hello() {
  console.log("hello");
}
=======
REPLACE
function hello() {
  console.log("hello world");
}
=======`

			const blocks = parseDiffBlocks(diffContent, "test.ts")
			assert.strictEqual(blocks.length, 1)
			assert.deepStrictEqual(blocks[0], {
				id: blocks[0].id, // We can't predict the hash
				path: "test.ts",
				searchContent: `function hello() {
  console.log("hello");
}`,
				replaceContent: `function hello() {
  console.log("hello world");
}`,
				isDelete: false,
			})
		})

		it("should parse multiple SEARCH/REPLACE blocks", () => {
			const diffContent = `SEARCH
const a = 1;
=======
REPLACE
const a = 2;
=======
SEARCH
function test() {}
=======
REPLACE
function test() { return true; }
=======`

			const blocks = parseDiffBlocks(diffContent, "test.ts")
			assert.strictEqual(blocks.length, 2)
			assert.deepStrictEqual(blocks[0], {
				id: blocks[0].id,
				path: "test.ts",
				searchContent: "const a = 1;",
				replaceContent: "const a = 2;",
				isDelete: false,
			})
			assert.deepStrictEqual(blocks[1], {
				id: blocks[1].id,
				path: "test.ts",
				searchContent: "function test() {}",
				replaceContent: "function test() { return true; }",
				isDelete: false,
			})
		})

		it("should handle delete operations (empty REPLACE block)", () => {
			const diffContent = `SEARCH
console.log("delete me");
=======
REPLACE

=======`

			const blocks = parseDiffBlocks(diffContent, "test.ts")
			assert.strictEqual(blocks.length, 1)
			assert.deepStrictEqual(blocks[0], {
				id: blocks[0].id,
				path: "test.ts",
				searchContent: 'console.log("delete me");',
				replaceContent: "",
				isDelete: true,
			})
		})
	})

	describe("parseDiffBlocks with streamed content", () => {
		// Helper function to simulate streaming with specific chunk sizes
		async function simulateStreaming(
			diff: string,
			delayMs: number
		): Promise<AsyncGenerator<string, void, unknown>> {
			// Get random chunk size between 6-24 chars
			function getRandomChunkSize() {
				return Math.floor(Math.random() * (24 - 6 + 1)) + 6
			}

			// Accumulate the string as we stream
			let streamedContent = ""

			async function* generator() {
				while (streamedContent.length < diff.length) {
					const chunkSize = getRandomChunkSize()
					const nextChunk = diff.slice(streamedContent.length, streamedContent.length + chunkSize)
					streamedContent += nextChunk
					yield streamedContent
					await delay(delayMs)
				}
			}

			return generator()
		}

		it("Should work with chunk boundaries", async () => {
			const diffContent = `SEARCH
	  const oldCode = 1;
	  =======
	  REPLACE
	  const newCode = 2;`

			// Test cases for different chunk boundaries
			const testCases = [
				// Minimal complete chunks
				[diffContent.length], // All at once
				// Split at key points
				[20, diffContent.length - 20], // Split in middle
				[7, 10, 10, 10, 10], // Multiple small chunks
				// Edge case splits
				[diffContent.indexOf("=======") + 1, diffContent.length], // Split at first separator
				[diffContent.indexOf("REPLACE") + 1, diffContent.length], // Split at REPLACE
			]

			for (const chunkSizes of testCases) {
				const stream = await simulateStreaming(diffContent, 25)
				let lastBlocks: EditBlock[] = []

				for await (const chunk of stream) {
					const blocks = parseDiffBlocks(chunk, "test.ts")
					if (blocks.length > 0) {
						lastBlocks = blocks
					}
				}

				// Verify final result
				assert.strictEqual(lastBlocks.length, 1, `Failed with chunk sizes: ${JSON.stringify(chunkSizes)}`)
				assert.strictEqual(lastBlocks[0].searchContent.trim(), "const oldCode = 1;")
				assert.strictEqual(lastBlocks[0].replaceContent.trim(), "const newCode = 2;")
			}
		})

		it("Should handle incomplete chunks correctly", async () => {
			const incompleteCases = [
				// Partial markers
				"SE",
				"SEARCH\n",
				// Missing sections
				"SEARCH\ncode\n=======\n",
				"SEARCH\ncode\n=======\nRE",
				// Incomplete blocks
				"SEARCH\ncode\n=======\nREPLACE\nnew",
			]

			let index = 0
			for (const content of incompleteCases) {
				const blocks = parseDiffBlocks(content, "test.ts")
				if (index < 2) {
					assert.strictEqual(blocks.length, 0, `Should return empty array for incomplete content: ${content}`)
				} else {
					assert.strictEqual(blocks.length, 1, `Should return one block for incomplete content: ${content}`)
				}
				index++
			}
		})

		it("Should handle delete blocks correctly", async () => {
			const deleteBlock = `SEARCH
	  const toDelete = true;
	  =======
	  REPLACE
	  `

			const stream = await simulateStreaming(deleteBlock, 25)
			let lastBlocks: EditBlock[] = []
			let lastChunk = ""
			for await (const chunk of stream) {
				lastChunk = chunk
				lastBlocks = parseDiffBlocks(chunk, "test.ts")
			}
			console.log(lastBlocks)

			assert.strictEqual(lastBlocks.length, 1, "Should have one block")
			assert.strictEqual(lastBlocks[0].isDelete, true, "Block should be marked as delete")
			assert.strictEqual(lastBlocks[0].searchContent.trim(), "const toDelete = true;")
			assert.strictEqual(lastBlocks[0].replaceContent, "")
		})
	})
	describe("applyEditBlocksToFile", () => {
		it("should apply single edit block correctly", async () => {
			const content = "function test() {\n  return false;\n}"
			const blocks: EditBlock[] = [
				{
					id: "1",
					path: "test.ts",
					searchContent: "function test() {\n  return false;\n}",
					replaceContent: "function test() {\n  return true;\n}",
				},
			]

			const result = await applyEditBlocksToFile(content, blocks)
			assert.strictEqual(result, "function test() {\n  return true;\n}")
		})

		it("should apply multiple edit blocks in sequence", async () => {
			const content = "const a = 1;\nconst b = 2;\nconst c = 3;"
			const blocks: EditBlock[] = [
				{
					id: "1",
					path: "test.ts",
					searchContent: "const a = 1;",
					replaceContent: "const a = 10;",
				},
				{
					id: "2",
					path: "test.ts",
					searchContent: "const c = 3;",
					replaceContent: "const c = 30;",
				},
			]

			const result = await applyEditBlocksToFile(content, blocks)
			assert.strictEqual(result, "const a = 10;\nconst b = 2;\nconst c = 30;")
		})
	})

	describe("replaceIgnoringIndentation", () => {
		it("should replace content while preserving indentation", () => {
			const content = "  function test() {\n    return false;\n  }"
			const search = "function test() {\n  return false;\n}"
			const replace = "function test() {\n  return true;\n}"

			const result = replaceIgnoringIndentation(content, search, replace)
			assert.strictEqual(result, "  function test() {\n    return true;\n  }")
		})

		it("should handle mixed indentation levels", () => {
			const content = '    if (true) {\n      console.log("test");\n    }'
			const search = 'if (true) {\n  console.log("test");\n}'
			const replace = 'if (true) {\n  console.log("updated");\n}'

			const result = replaceIgnoringIndentation(content, search, replace)
			assert.strictEqual(result, '    if (true) {\n      console.log("updated");\n    }')
		})
	})

	describe("preprocessContent", () => {
		it("should remove code fence markers", () => {
			const content = "```typescript\nconst x = 1;\n```"
			assert.strictEqual(preprocessContent(content), "const x = 1;")
		})

		it("should normalize quotes and angle brackets", () => {
			const content = 'const x = "test"; console.log(<div>)</div>);'
			assert.strictEqual(preprocessContent(content), 'const x = "test"; console.log(<div>)</div>);')
		})

		it("should trim whitespace", () => {
			const content = "\n\n  const x = 1;  \n\n"
			assert.strictEqual(preprocessContent(content), "const x = 1;")
		})
	})

	describe("adjustIndentationPerLine", () => {
		it("should adjust indentation based on original content", () => {
			const contentSlice = ["    function test() {", "      return false;", "    }"]
			const searchLines = ["function test() {", "  return false;", "}"]
			const replaceLines = ["function test() {", "  return true;", "}"]

			const result = adjustIndentationPerLine(contentSlice, searchLines, replaceLines)
			assert.deepStrictEqual(result, ["    function test() {", "      return true;", "    }"])
		})

		it("should handle empty lines", () => {
			const contentSlice = ["    if (true) {", "      ", "    }"]
			const searchLines = ["if (true) {", "", "}"]
			const replaceLines = ["if (true) {", "", "}"]

			const result = adjustIndentationPerLine(contentSlice, searchLines, replaceLines)
			assert.deepStrictEqual(result, ["    if (true) {", "      ", "    }"])
		})
	})
})
