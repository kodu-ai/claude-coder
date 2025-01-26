import { DiagnosticsHandler } from "../../../../src/agent/v1/handlers/diagnostics-handler"
import * as assert from "assert"
import dedent from "dedent"
import path from "path"
import * as vscode from "vscode"
import "mocha"

const testFileContent = dedent`
type User = {
    id: number;
    name: string;
}

export const createUser = (id: number, name: string): User => {
    return { id, name };
}

const getUser = (user: User): string => {
    return user.name;
}

// Below lines should produce TS errors for testing purposes
const badUserCreation = createUser('name', 1)
const secondUser = createUser(2)
const badGetttingUser = getUser({})
`

describe("DiagnosticsHandler POC Tests", () => {
	const testFile = path.resolve(__dirname, "files", "test.ts")

	before(async () => {
		// Write the test content to test.ts in the test workspace
		const uri = vscode.Uri.file(testFile)
		await vscode.workspace.fs.writeFile(uri, Buffer.from(testFileContent))
	})

	after(async () => {
		// Delete the temporary file test.ts after the tests finish
		const filePath = path.resolve(__dirname, testFile)
		const uri = vscode.Uri.file(filePath)
		await vscode.workspace.fs.delete(uri, { recursive: true, useTrash: false })
		// delete the folder
		const folderPath = path.resolve(__dirname, "files")
		const folderUri = vscode.Uri.file(folderPath)
		await vscode.workspace.fs.delete(folderUri, { recursive: true, useTrash: false })
	})

	it("Fetch diagnostics without opening file", async () => {
		const handler = DiagnosticsHandler.getInstance()
		const results = await handler.getDiagnostics([testFile])
		console.log("Without Opening:", results)

		assert.ok(Array.isArray(results))
		// Add assertions if necessary
	})

	it("Fetch diagnostics after opening file", async () => {
		const handler = DiagnosticsHandler.getInstance()
		const results = await handler.getDiagnostics([testFile])
		console.log("With Opening:", results)

		assert.ok(Array.isArray(results))
		// Add assertions if necessary
	})
})
