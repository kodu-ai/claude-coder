// diff-block-manager.test.ts

import { expect } from "chai"
import "mocha"
import {
	DiffBlockManager,
	SEARCH_HEAD,
	SEPARATOR,
	REPLACE_HEAD,
} from "../../../../src/agent/v1/tools/runners/coders/utils"

describe("DiffBlockManager - parseDiffBlocks", () => {
	let manager: DiffBlockManager

	beforeEach(() => {
		manager = new DiffBlockManager()
	})

	it("should parse a single fully-finalized block", () => {
		// Build a diff that has HEAD, separator, and updated
		const diff = [SEARCH_HEAD, "hello world", SEPARATOR, "goodbye world", REPLACE_HEAD].join("\n")

		// parseDiffBlocks is private in your code, so we either:
		//  - temporarily make it public for testing, or
		//  - call parseAndMergeDiff, which calls parseDiffBlocks internally.
		// For demonstration, let's assume we can call parseDiffBlocks directly:
		const blocks = manager["parseDiffBlocks"](diff, "/test/path")

		expect(blocks.length).to.equal(1)
		const block = blocks[0]
		expect(block.id).to.equal("0")
		expect(block.path).to.equal("/test/path")
		expect(block.searchContent).to.equal("hello world")
		expect(block.replaceContent).to.equal("goodbye world")
		expect(block.isDelete).to.be.false
		expect(block.isFinalized).to.be.true
	})

	it("should parse a block missing >>>>>>> updated as unfinalized", () => {
		// No REPLACE_HEAD => unfinalized
		const diff = [
			SEARCH_HEAD,
			"partial block",
			SEPARATOR,
			"replace partial block",
			// Omit REPLACE_HEAD
		].join("\n")

		const blocks = manager["parseDiffBlocks"](diff, "/test/path")

		// We get exactly 1 incomplete block
		expect(blocks.length).to.equal(1)
		const block = blocks[0]
		expect(block.id).to.equal("0")
		expect(block.path).to.equal("/test/path")
		expect(block.searchContent).to.equal("partial block")
		expect(block.replaceContent).to.equal("replace partial block")
		expect(block.isDelete).to.be.false
		// no ">>>>>>> updated", so:
		expect(block.isFinalized).to.be.false
	})

	it("should discard a block if no ======= is found (search never completes)", () => {
		const diff = [
			SEARCH_HEAD,
			"some partial lines", // We never see the '======='
			// next HEAD arrives
			SEARCH_HEAD,
			"another HEAD line",
			SEPARATOR,
			"replace for second block",
			REPLACE_HEAD,
		].join("\n")

		const blocks = manager["parseDiffBlocks"](diff, "/test/path")

		// The "first" block had HEAD but never saw '=======', so it's discarded.
		// The "second" block is complete.
		expect(blocks.length).to.equal(1)

		const block = blocks[0]
		expect(block.id).to.equal("0")
		expect(block.searchContent).to.equal("another HEAD line")
		expect(block.replaceContent).to.equal("replace for second block")
		expect(block.isFinalized).to.be.true
	})

	it("should parse multiple blocks in order", () => {
		// Two distinct HEAD->SEPARATOR->UPDATED blocks in sequence
		const diff = [
			SEARCH_HEAD,
			"Block1 search",
			SEPARATOR,
			"Block1 replace",
			REPLACE_HEAD,

			SEARCH_HEAD,
			"Block2 search line1",
			"Block2 search line2",
			SEPARATOR,
			"Block2 replace line1",
			"Block2 replace line2",
			REPLACE_HEAD,
		].join("\n")

		const blocks = manager["parseDiffBlocks"](diff, "/test/path")

		expect(blocks.length).to.equal(2)

		const first = blocks[0]
		expect(first.id).to.equal("0")
		expect(first.searchContent).to.equal("Block1 search")
		expect(first.replaceContent).to.equal("Block1 replace")
		expect(first.isFinalized).to.be.true

		const second = blocks[1]
		expect(second.id).to.equal("1")
		expect(second.searchContent).to.equal("Block2 search line1\nBlock2 search line2")
		expect(second.replaceContent).to.equal("Block2 replace line1\nBlock2 replace line2")
		expect(second.isFinalized).to.be.true
	})
})
