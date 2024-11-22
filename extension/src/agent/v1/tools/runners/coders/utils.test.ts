import { describe, expect, test } from "@jest/globals"
import {
	findCodeBlock,
	findSimilarLines,
	applyEditBlocksToFile,
	getEditBlockPositions,
	replaceIgnoringIndentation,
	adjustIndentationPerLine,
	parseDiffBlocks,
	findBestBlockMatch,
	checkFileExists,
	preprocessContent,
	EditBlock,
} from "./utils"

describe("findCodeBlock", () => {
	test("should find simple code block", () => {
		const content = `
function test() {
  const x = 1;
  return x;
}`
		console.log(`Testing findCodeBlock`)
		const result = findCodeBlock(content, 0)
		expect(result).toEqual({ start: 1, end: 4 })
	})

	test("should handle nested blocks", () => {
		const content = `
function outer() {
  if (true) {
    return 1;
  }
  return 2;
}`
		const result = findCodeBlock(content, 0)
		expect(result).toEqual({ start: 1, end: 6 })
	})

	test("should return null for no block", () => {
		const content = "const x = 1;"
		const result = findCodeBlock(content, 0)
		expect(result).toBeNull()
	})
})

describe("findSimilarLines", () => {
	test("should find exact match", async () => {
		const search = "const x = 1;\nconst y = 2;"
		const content = "let a = 0;\nconst x = 1;\nconst y = 2;\nlet b = 3;"
		const result = await findSimilarLines(search, content)
		expect(result).toBe("const x = 1;\nconst y = 2;")
	})

	test("should find similar match above threshold", async () => {
		const search = "const x = 1;\nconst y = 2;"
		const content = "let a = 0;\nconst x = 1;\nlet y = 2;\nlet b = 3;"
		const result = await findSimilarLines(search, content, 0.5)
		expect(result).toBe("const x = 1;\nlet y = 2;")
	})

	test("should return empty string for no match", async () => {
		const search = "const x = 1;"
		const content = "const y = 2;"
		const result = await findSimilarLines(search, content, 0.8)
		expect(result).toBe("")
	})
})

describe("applyEditBlocksToFile", () => {
	test("should apply single edit block", async () => {
		const content = "const x = 1;\nconst y = 2;"
		const blocks: EditBlock[] = [
			{
				path: "test.ts",
				searchContent: "const x = 1;",
				replaceContent: "const x = 100;",
			},
		]
		const result = await applyEditBlocksToFile(content, blocks)
		expect(result).toBe("const x = 100;\nconst y = 2;")
	})

	test("should apply multiple edit blocks", async () => {
		const content = "const x = 1;\nconst y = 2;\nconst z = 3;"
		const blocks: EditBlock[] = [
			{
				path: "test.ts",
				searchContent: "const x = 1;",
				replaceContent: "const x = 100;",
			},
			{
				path: "test.ts",
				searchContent: "const z = 3;",
				replaceContent: "const z = 300;",
			},
		]
		const result = await applyEditBlocksToFile(content, blocks)
		expect(result).toBe("const x = 100;\nconst y = 2;\nconst z = 300;")
	})
})

describe("getEditBlockPositions", () => {
	test("should get positions for single block", () => {
		const content = "const x = 1;\nconst y = 2;"
		const blocks: EditBlock[] = [
			{
				path: "test.ts",
				searchContent: "const x = 1;",
				replaceContent: "const x = 100;",
			},
		]
		const result = getEditBlockPositions(content, blocks)
		expect(result[0].position).toEqual({
			blockIndex: 0,
			startLine: 0,
			endLine: 0,
		})
	})

	test("should handle multiple blocks", () => {
		const content = "const x = 1;\nconst y = 2;\nconst z = 3;"
		const blocks: EditBlock[] = [
			{
				path: "test.ts",
				searchContent: "const x = 1;",
				replaceContent: "const x = 100;",
			},
			{
				path: "test.ts",
				searchContent: "const z = 3;",
				replaceContent: "const z = 300;",
			},
		]
		const result = getEditBlockPositions(content, blocks)
		expect(result[0].position).toEqual({
			blockIndex: 0,
			startLine: 0,
			endLine: 0,
		})
		expect(result[1].position).toEqual({
			blockIndex: 1,
			startLine: 2,
			endLine: 2,
		})
	})
})

describe("replaceIgnoringIndentation", () => {
	test("should preserve indentation when replacing", () => {
		const content = "  const x = 1;\n    const y = 2;"
		const search = "const x = 1;\nconst y = 2;"
		const replace = "let x = 100;\nlet y = 200;"
		const result = replaceIgnoringIndentation(content, search, replace)
		expect(result).toBe("  let x = 100;\n    let y = 200;")
	})

	test("should handle different indentation levels", () => {
		const content = "function test() {\n  const x = 1;\n    const y = 2;\n}"
		const search = "const x = 1;\nconst y = 2;"
		const replace = "let x = 100;\nlet y = 200;"
		const result = replaceIgnoringIndentation(content, search, replace)
		expect(result).toBe("function test() {\n  let x = 100;\n    let y = 200;\n}")
	})
})

describe("adjustIndentationPerLine", () => {
	test("should adjust indentation correctly", () => {
		const contentSlice = ["  const x = 1;", "    const y = 2;"]
		const searchLines = ["const x = 1;", "const y = 2;"]
		const replaceLines = ["let x = 100;", "let y = 200;"]
		const result = adjustIndentationPerLine(contentSlice, searchLines, replaceLines)
		expect(result).toEqual(["  let x = 100;", "    let y = 200;"])
	})

	test("should handle empty indentation", () => {
		const contentSlice = ["const x = 1;", "const y = 2;"]
		const searchLines = ["const x = 1;", "const y = 2;"]
		const replaceLines = ["let x = 100;", "let y = 200;"]
		const result = adjustIndentationPerLine(contentSlice, searchLines, replaceLines)
		expect(result).toEqual(["let x = 100;", "let y = 200;"])
	})
})

describe("parseDiffBlocks", () => {
	test("should parse single diff block", () => {
		const diffContent = `SEARCH
const x = 1;
=======
REPLACE
const x = 100;`
		const result = parseDiffBlocks(diffContent, "test.ts")
		expect(result).toEqual([
			{
				path: "test.ts",
				searchContent: "const x = 1;",
				replaceContent: "const x = 100;",
				isDelete: false,
			},
		])
	})

	test("should parse multiple diff blocks", () => {
		const diffContent = `SEARCH
const x = 1;
=======
REPLACE
const x = 100;
SEARCH
const y = 2;
=======
REPLACE
const y = 200;`
		const result = parseDiffBlocks(diffContent, "test.ts")
		expect(result).toEqual([
			{
				path: "test.ts",
				searchContent: "const x = 1;",
				replaceContent: "const x = 100;",
				isDelete: false,
			},
			{
				path: "test.ts",
				searchContent: "const y = 2;",
				replaceContent: "const y = 200;",
				isDelete: false,
			},
		])
	})
})

describe("findBestBlockMatch", () => {
	test("should find exact match", () => {
		const search = "const x = 1;\nconst y = 2;"
		const content = "let a = 0;\nconst x = 1;\nconst y = 2;\nlet b = 3;"
		const result = findBestBlockMatch(search, content)
		expect(result).toEqual({
			start: 1,
			end: 2,
			score: 1.0,
		})
	})

	test("should find similar match above threshold", () => {
		const search = "function test() {\n  return 1;\n}"
		const content = "const a = 0;\nfunction test() {\n  return 2;\n}\nconst b = 3;"
		const result = findBestBlockMatch(search, content, 0.5)
		expect(result?.start).toBe(1)
		expect(result?.end).toBe(3)
		expect(result?.score).toBeGreaterThan(0.5)
	})
})

describe("preprocessContent", () => {
	test("should remove markdown code blocks", () => {
		const content = "```typescript\nconst x = 1;\n```"
		const result = preprocessContent(content)
		expect(result).toBe("const x = 1;")
	})

	test("should handle content without code blocks", () => {
		const content = "const x = 1;"
		const result = preprocessContent(content)
		expect(result).toBe("const x = 1;")
	})

	test("should normalize quotes and angle brackets", () => {
		const content = 'const x = "test"; // <div>'
		const result = preprocessContent(content)
		expect(result).toBe('const x = "test"; // <div>')
	})
})

describe("checkFileExists", () => {
	test("should return true for existing file", async () => {
		// This test assumes utils.ts exists in the same directory
		const result = await checkFileExists("extension/src/agent/v1/tools/runners/coders/utils.ts")
		expect(result).toBe(true)
	})

	test("should return false for non-existing file", async () => {
		const result = await checkFileExists("non-existing-file.ts")
		expect(result).toBe(false)
	})
})
