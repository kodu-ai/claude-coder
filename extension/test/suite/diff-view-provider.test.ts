import * as assert from "assert"
import * as fs from "fs"
import type * as Mocha from 'mocha'
import * as path from "path"
import * as vscode from "vscode"
import { DiffViewProvider } from "../../src/integrations/editor/diff-view-provider"

describe("DiffViewProvider End-to-End Test", () => {
    const testDir = path.join(__dirname)
    let diffViewProvider: DiffViewProvider
    let diffContentProvider: vscode.Disposable
    
    const testContent = {
        initial: `function test() {\n    console.log("test")\n}\n`,
        updated: `function test() {\n    console.log("updated")\n    return true\n}\n`,
        python: {
            initial: "def test():\n  print('test')\n",
            updated: "def test():\n    print('updated')\n    return True\n"
        }
    }

    beforeEach(async () => {
        diffContentProvider = vscode.workspace.registerTextDocumentContentProvider(
            'claude-coder-diff',
            {
                provideTextDocumentContent(uri: vscode.Uri): string {
                    return Buffer.from(uri.query, 'base64').toString()
                }
            }
        )
        
        diffViewProvider = new DiffViewProvider(testDir, {} as any)

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

    it("should handle basic file update", async function() {
        this.timeout(30000)
        
        const filePath = path.join(testDir, "test.ts")
        fs.writeFileSync(filePath, testContent.initial)
        
        const success = await diffViewProvider.open(path.relative(testDir, filePath))
        assert.strictEqual(success, true)
        await waitForUpdate()

        await diffViewProvider.update(testContent.updated, true)
        await waitForUpdate()

        const { finalContent } = await diffViewProvider.saveChanges()
        assert.strictEqual(finalContent, testContent.updated)
    })

    it("should handle Python formatting", async function() {
        this.timeout(30000)
        
        const filePath = path.join(testDir, "test.py")
        fs.writeFileSync(filePath, testContent.python.initial)
        
        const success = await diffViewProvider.open(path.relative(testDir, filePath))
        assert.strictEqual(success, true)
        await waitForUpdate()

        await diffViewProvider.update(testContent.python.updated, true)
        await waitForUpdate()

        const { finalContent } = await diffViewProvider.saveChanges()
        assert.strictEqual(finalContent.includes("    print"), true)
    })

    it("should handle new file creation", async function() {
        this.timeout(30000)
        
        const newFilePath = path.join(testDir, "test.ts")
        if (fs.existsSync(newFilePath)) {
            fs.unlinkSync(newFilePath)
        }

        const success = await diffViewProvider.open(path.relative(testDir, newFilePath))
        assert.strictEqual(success, true)
        await waitForUpdate()

        await diffViewProvider.update(testContent.initial, true)
        await waitForUpdate()

        const { finalContent } = await diffViewProvider.saveChanges()
        assert.strictEqual(finalContent, testContent.initial)
        assert.strictEqual(fs.existsSync(newFilePath), true)
    })

    it("should handle revert changes", async function(this: Mocha.Context) {
        this.timeout(30000)
        
        const filePath = path.join(testDir, "test.ts")
        fs.writeFileSync(filePath, testContent.initial)
        
        const success = await diffViewProvider.open(path.relative(testDir, filePath))
        assert.strictEqual(success, true)
        await waitForUpdate()

        await diffViewProvider.update(testContent.updated, true)
        await waitForUpdate()
        
        await diffViewProvider.revertChanges()
        await waitForUpdate()

        const content = fs.readFileSync(filePath, 'utf-8')
        assert.strictEqual(content, testContent.initial)
    })
}) 