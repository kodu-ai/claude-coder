import * as assert from "assert"
import * as fs from "fs"
import type * as Mocha from 'mocha'
import * as path from "path"
import * as vscode from "vscode"
import { FullFileEditor } from "../../src/integrations/editor/full-file-editor"

describe("FullFileEditor End-to-End Test", () => {
    const testDir = path.join(__dirname)
    let editor: FullFileEditor
    let diffContentProvider: vscode.Disposable
    
    const testContent = {
        initial: `function test() {\n    console.log("test")\n}\n`,
        updated: `function test() {\n    console.log("updated")\n    return true\n}\n`,
        searchReplace: {
            search: 'console.log("test")',
            replace: 'console.log("updated")\n    return true'
        },
        python: {
            initial: "def test():\n  print('test')\n",
            updated: "def test():\n    print('updated')\n    return True\n",
            search: "print('test')",
            replace: "print('updated')\n    return True"
        }
    }

    beforeEach(async () => {
        // Register content providers
        diffContentProvider = vscode.workspace.registerTextDocumentContentProvider(
            'claude-coder-diff',
            {
                provideTextDocumentContent(uri: vscode.Uri): string {
                    return Buffer.from(uri.query, 'base64').toString()
                }
            }
        )
        
        editor = new FullFileEditor(testDir, {} as any)
        await new Promise(resolve => setTimeout(resolve, 1000))
    })

    afterEach(async () => {
        if (diffContentProvider) {
            diffContentProvider.dispose()
        }

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

    it("should handle streaming updates with search/replace", async function() {
        this.timeout(30000)
        
        const filePath = path.join(testDir, "test.ts")
        fs.writeFileSync(filePath, testContent.initial)
        
        // Open file with initial search content
        const success = await editor.open(
            "test-block",
            filePath,
            testContent.searchReplace.search
        )
        assert.strictEqual(success, true)
        await waitForUpdate()

        // Apply streaming content
        await editor.applyStreamContent(
            "test-block",
            testContent.searchReplace.search,
            testContent.searchReplace.replace
        )
        await waitForUpdate()

        // Apply final content and show diff
        await editor.applyFinalContent(
            "test-block",
            testContent.searchReplace.search,
            testContent.searchReplace.replace
        )
        await waitForUpdate()

        // Save changes
        const { finalContent } = await editor.saveChanges()
        assert.strictEqual(finalContent, testContent.updated)
    })

    it("should handle new file creation", async function() {
        this.timeout(30000)
        
        const newFilePath = path.join(testDir, "test.ts")
        if (fs.existsSync(newFilePath)) {
            fs.unlinkSync(newFilePath)
        }

        // Open new file
        const success = await editor.open("new-file", newFilePath, testContent.initial)
        assert.strictEqual(success, true)
        await waitForUpdate()

        // Apply final content directly
        await editor.applyFinalContent("new-file", testContent.initial, testContent.initial)
        await waitForUpdate()

        // Save changes
        const { finalContent } = await editor.saveChanges()
        assert.strictEqual(finalContent, testContent.initial)
        assert.strictEqual(fs.existsSync(newFilePath), true)
    })

    it("should handle Python file formatting", async function() {
        this.timeout(30000)
        
        const filePath = path.join(testDir, "test.py")
        fs.writeFileSync(filePath, testContent.python.initial)
        
        // Open file with search content
        const success = await editor.open(
            "python-block",
            filePath,
            testContent.python.search
        )
        assert.strictEqual(success, true)
        await waitForUpdate()

        // Apply final content
        await editor.applyFinalContent(
            "python-block",
            testContent.python.search,
            testContent.python.replace
        )
        await waitForUpdate()

        // Save changes
        const { finalContent } = await editor.saveChanges()
        assert.strictEqual(finalContent.includes("    print"), true)
    })

    it("should handle multiple edit blocks", async function() {
        this.timeout(30000)
        
        const filePath = path.join(testDir, "test.ts")
        const initialContent = `
            function test1() {
                console.log("test1")
            }
            function test2() {
                console.log("test2")
            }
        `.trim()

        fs.writeFileSync(filePath, initialContent)
        
        // First block
        await editor.open("block1", filePath, 'console.log("test1")')
        await editor.applyFinalContent("block1", 'console.log("test1")', 'console.log("updated1")')
        await waitForUpdate()

        // Second block
        await editor.open("block2", filePath, 'console.log("test2")')
        await editor.applyFinalContent("block2", 'console.log("test2")', 'console.log("updated2")')
        await waitForUpdate()

        const { finalContent } = await editor.saveChanges()
        assert.strictEqual(finalContent.includes('"updated1"'), true)
        assert.strictEqual(finalContent.includes('"updated2"'), true)
    })

    it("should handle reject changes", async function() {
        this.timeout(30000)
        
        const filePath = path.join(testDir, "test.ts")
        fs.writeFileSync(filePath, testContent.initial)
        
        // Open and modify file
        await editor.open(
            "test-block",
            filePath,
            testContent.searchReplace.search
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
        assert.strictEqual(content, testContent.initial)
    })

    it("should detect user edits in diff view", async function() {
        this.timeout(30000)
        
        const filePath = path.join(testDir, "test.ts")
        fs.writeFileSync(filePath, testContent.initial)
        
        await editor.open(
            "test-block",
            filePath,
            testContent.searchReplace.search
        )
        await editor.applyFinalContent(
            "test-block",
            testContent.searchReplace.search,
            testContent.searchReplace.replace
        )
        await waitForUpdate()

        // Simulate user edit in diff view
        if (editor['diffEditor']) {
            const edit = new vscode.WorkspaceEdit()
            const document = editor['diffEditor'].document
            edit.insert(
                document.uri,
                new vscode.Position(2, 0),
                '    console.log("user edit")\n'
            )
            await vscode.workspace.applyEdit(edit)
            await waitForUpdate()
        }

        const { finalContent, userEdits } = await editor.saveChanges()
        assert.strictEqual(userEdits !== undefined, true)
        assert.strictEqual(finalContent.includes('"user edit"'), true)
    })
}) 