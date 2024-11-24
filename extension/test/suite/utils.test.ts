import {
	parseDiffBlocks,
	applyEditBlocksToFile,
	replaceIgnoringIndentation,
	adjustIndentationPerLine,
	EditBlock,
	preprocessContent,
} from "../../src/agent/v1/tools/runners/coders/utils"
import * as assert from "assert"

describe("Edit Blocks Parser and Validator", () => {
	describe("parseDiffBlocks", () => {
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
