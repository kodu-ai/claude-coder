// src/test/suite/extension.test.ts

import * as vscode from "vscode"
import { before } from "mocha"
import { suite, test } from "mocha"

suite("Extension Test Suite", () => {
	let extension: vscode.Extension<any>

	before(async () => {
		// Activate the extension before running tests
		extension = vscode.extensions.getExtension("kodu-ai.claude-dev-experimental")!
		await extension.activate()

		await new Promise((resolve) => setTimeout(resolve, 5000)) // Sleep for 5 seconds
	})

	test("All commands are registered", async () => {
		// blackmagicfuckery, but works
		const folder = vscode.workspace.workspaceFolders?.map((folder) => folder.uri.fsPath).at(0)
		const lastFolder = folder?.split("/").at(-1)
		const problemStatement = await vscode.workspace.fs.readFile(
			vscode.Uri.file(folder + `./../../tests/00_problem_statements/${lastFolder}.txt`)
		)
		const problemStatementString = problemStatement.toString()

		// Read problem statement file
		const result = await vscode.commands.executeCommand("kodu-claude-coder-main.startTask", problemStatementString)

		await new Promise((resolve) => setTimeout(resolve, 100000)) // Sleep for 60 seconds
	})
})
