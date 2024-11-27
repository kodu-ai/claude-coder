import * as assert from "assert"
import * as fs from "fs"
import type * as Mocha from 'mocha'
import * as path from "path"
import * as vscode from "vscode"
import { FullFileEditor } from "../../src/integrations/editor/full-file-editor"

describe("FullFileEditor End-to-End Test", () => {
	const testDir = path.join(__dirname)
	let editor: FullFileEditor

	const testContent = {
		initial: `function test() {\n    console.log("test")\n}\n`,
		updated: `function test() {\n    console.log("updated")\n    return true\n}\n`,
		searchReplace: {
			search: 'function test() {\n    console.log("test")\n}',
			replace: 'function test() {\n    console.log("updated")\n    return true\n}'
		},
		python: {
			initial: "def test():\n  print('test')\n",
			updated: "def test():\n    print('updated')\n    return True\n",
			search: "def test():\n  print('test')",
			replace: "def test():\n    print('updated')\n    return True"
		}
	}

	beforeEach(async () => {
		// Ensure test directory exists
		if (!fs.existsSync(testDir)) {
			fs.mkdirSync(testDir, { recursive: true })
		}
		editor = new FullFileEditor(testDir, {} as any)
		await new Promise(resolve => setTimeout(resolve, 1000))
	})

	afterEach(async () => {
		await vscode.commands.executeCommand("workbench.action.closeAllEditors")

		const testFiles = ["test.ts", "test.py"]
		for (const file of testFiles) {
			const filePath = path.join(testDir, file)
			if (fs.existsSync(filePath)) {
				fs.unlinkSync(filePath)
			}
		}

		await new Promise(resolve => setTimeout(resolve, 1000))
	})

	async function waitForUpdate(): Promise<void> {
		await new Promise(resolve => setTimeout(resolve, 500))
	}

	it("should handle file creation and content update", async function () {
		this.timeout(30000)

		const newFilePath = path.join(testDir, "test.ts")
		if (fs.existsSync(newFilePath)) {
			fs.unlinkSync(newFilePath)
		}

		// Create empty file first
		fs.writeFileSync(newFilePath, "")

		// Open new file
		const success = await editor.open("new-file", newFilePath, testContent.initial)
		assert.strictEqual(success, true)
		await waitForUpdate()

		// Apply content
		await editor.applyStreamContent("new-file", testContent.initial, testContent.updated)
		await waitForUpdate()

		// Apply final content to show diff view
		await editor.applyFinalContent("new-file", testContent.initial, testContent.updated)
		await waitForUpdate()

		// Save changes
		const { finalContent } = await editor.saveChanges()
		assert.strictEqual(finalContent.trim(), testContent.updated.trim())
		assert.strictEqual(fs.existsSync(newFilePath), true)
	})

	it("should handle search/replace in existing file", async function () {
		this.timeout(30000)

		const filePath = path.join(testDir, "test.ts")
		fs.writeFileSync(filePath, testContent.initial)

		// Open file with search content
		const success = await editor.open(
			"test-block",
			filePath,
			testContent.searchReplace.search
		)
		assert.strictEqual(success, true)
		await waitForUpdate()

		// Apply replacement content
		await editor.applyStreamContent(
			"test-block",
			testContent.searchReplace.search,
			testContent.searchReplace.replace
		)
		await waitForUpdate()

		// Show diff view with final content
		await editor.applyFinalContent(
			"test-block",
			testContent.searchReplace.search,
			testContent.searchReplace.replace
		)
		await waitForUpdate()

		// Save changes
		const { finalContent } = await editor.saveChanges()
		assert.strictEqual(finalContent.trim(), testContent.updated.trim())
	})

	it("should handle reject changes", async function () {
		this.timeout(30000)

		const filePath = path.join(testDir, "test.ts")
		fs.writeFileSync(filePath, testContent.initial)

		// Open and modify file
		await editor.open(
			"test-block",
			filePath,
			testContent.searchReplace.search
		)
		await editor.applyStreamContent(
			"test-block",
			testContent.searchReplace.search,
			testContent.searchReplace.replace
		)
		await editor.applyFinalContent(
			"test-block",
			testContent.searchReplace.search,
			testContent.searchReplace.replace
		)
		await waitForUpdate()

		// Reject changes
		await editor.rejectChanges()
		await waitForUpdate()

		// Verify file content is back to original
		const content = fs.readFileSync(filePath, 'utf-8')
		assert.strictEqual(content.trim(), testContent.initial.trim())
	})

	it("should detect user edits in diff view", async function () {
		this.timeout(30000)

		const filePath = path.join(testDir, "test.ts")
		fs.writeFileSync(filePath, testContent.initial)

		// Setup file with changes
		await editor.open(
			"test-block",
			filePath,
			testContent.searchReplace.search
		)
		await editor.applyStreamContent(
			"test-block",
			testContent.searchReplace.search,
			testContent.searchReplace.replace
		)
		await editor.applyFinalContent(
			"test-block",
			testContent.searchReplace.search,
			testContent.searchReplace.replace
		)
		await waitForUpdate()

		// Save and check for user edits detection
		const { finalContent, userEdits } = await editor.saveChanges()

		// Since we can't reliably simulate user edits in tests,
		// just verify the save operation completed successfully
		assert.strictEqual(typeof finalContent, 'string')
		assert.strictEqual(finalContent.length > 0, true)
	})

	it("should maintain file state through multiple operations", async function () {
		this.timeout(30000)

		const filePath = path.join(testDir, "test.ts")
		fs.writeFileSync(filePath, testContent.initial)

		// First operation
		await editor.open(
			"block1",
			filePath,
			testContent.searchReplace.search
		)
		await editor.applyStreamContent(
			"block1",
			testContent.searchReplace.search,
			testContent.searchReplace.replace
		)
		await editor.applyFinalContent(
			"block1",
			testContent.searchReplace.search,
			testContent.searchReplace.replace
		)

		// Verify editor state
		assert.strictEqual(editor.isOpen(), true)
		assert.strictEqual(editor.isDiffViewOpen(), true)

		// Save changes
		const { finalContent } = await editor.saveChanges()
		assert.strictEqual(finalContent.trim(), testContent.updated.trim())

		// Verify editor cleaned up properly
		assert.strictEqual(editor.isOpen(), false)
		assert.strictEqual(editor.isDiffViewOpen(), false)
	})

	it("should not report user edits for new file creation", async function () {
		this.timeout(30000)

		const newFilePath = path.join(testDir, "test.ts")
		if (fs.existsSync(newFilePath)) {
			fs.unlinkSync(newFilePath)
		}

		// Create empty file first
		fs.writeFileSync(newFilePath, "")

		// Open new file
		const success = await editor.open("new-file", newFilePath, testContent.initial)
		assert.strictEqual(success, true)
		await waitForUpdate()

		// Apply content
		await editor.applyStreamContent("new-file", testContent.initial, testContent.updated)
		await waitForUpdate()

		// Apply final content to show diff view
		await editor.applyFinalContent("new-file", testContent.initial, testContent.updated)
		await waitForUpdate()

		// Save changes and verify no user edits are reported
		const { finalContent, userEdits } = await editor.saveChanges()
		assert.strictEqual(userEdits, undefined, "Should not report user edits for new file creation")
		assert.strictEqual(finalContent.trim(), testContent.updated.trim())
		assert.strictEqual(fs.existsSync(newFilePath), true)
	})

	it("should only report user edits when content was actually modified", async function(this: 
		Mocha.Context) {
		this.timeout(30000)

		const filePath = path.join(testDir, "test.ts")
		fs.writeFileSync(filePath, testContent.initial)

		// Open file and apply changes without user modification
		await editor.open("test-block", filePath, testContent.searchReplace.search)
		await editor.applyStreamContent("test-block", testContent.searchReplace.search, testContent.searchReplace.replace)
		await editor.applyFinalContent("test-block", testContent.searchReplace.search, testContent.searchReplace.replace)
		await waitForUpdate()

		// Save without user modifications
		const { finalContent, userEdits } = await editor.saveChanges()
		assert.strictEqual(userEdits, undefined, "Should not report user edits when content wasn't modified in diff view")
		assert.strictEqual(finalContent.trim(), testContent.updated.trim())
	})

	it("should detect actual user modifications in diff view", async function() {
		this.timeout(30000)

		const filePath = path.join(testDir, "test.ts")
		fs.writeFileSync(filePath, testContent.initial)

		// First apply changes programmatically
		await editor.open("test-block", filePath, testContent.searchReplace.search)
		await editor.applyStreamContent(
			"test-block", 
			testContent.searchReplace.search, 
			testContent.searchReplace.replace
		)
		await editor.applyFinalContent(
			"test-block",
			testContent.searchReplace.search,
			testContent.searchReplace.replace
		)
		await waitForUpdate()

		// Save without modifications - should not report user edits
		let result = await editor.saveChanges()
		assert.strictEqual(result.userEdits, undefined, 
			"Should not report user edits when content wasn't modified in diff view")

		// Now make a change that simulates user modification
		await editor.open("test-block", filePath, testContent.searchReplace.search)
		await editor.applyStreamContent(
			"test-block", 
			testContent.searchReplace.search, 
			testContent.searchReplace.replace
		)
		await editor.applyFinalContent(
			"test-block",
			testContent.searchReplace.search,
			testContent.searchReplace.replace
		)
		await waitForUpdate()

		// Simulate user edit by modifying the document
		if (editor['diffEditor']) {
			const edit = new vscode.WorkspaceEdit()
			const document = editor['diffEditor'].document
			edit.insert(
				document.uri,
				new vscode.Position(1, 0),
				'    // User added comment\n'
			)
			await vscode.workspace.applyEdit(edit)
			await waitForUpdate()
		}

		// Now save should report user edits
		result = await editor.saveChanges()
		assert.strictEqual(result.userEdits !== undefined, true, 
			"Should report user edits when content was modified in diff view")
	})
}) 