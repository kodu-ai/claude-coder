// src/test/suite/extension.test.ts

import * as vscode from "vscode"
import { before } from "mocha"
import { suite, test } from "mocha"

suite("Extension Test Suite", () => {
	let extension: vscode.Extension<any>

	before(async () => {
		extension = vscode.extensions.getExtension("kodu-ai.claude-dev-experimental")!
		await extension.activate()

		await new Promise((resolve) => setTimeout(resolve, 5000))
	})

	test("All commands are registered", async () => {
		// blackmagicfuckery, but works
		const folder = vscode.workspace.workspaceFolders?.map((folder) => folder.uri.fsPath).at(0)
		const lastFolder = folder?.split("/").at(-1)

		const problemStatement = await vscode.workspace.fs.readFile(
			vscode.Uri.file(folder + `./../../eval_data/00_problem_statements/${lastFolder}.json`)
		)
		const testCase = JSON.parse(problemStatement.toString())

		const failToPassText =
			"These failing test cases would pass if the problem is resolved:\n" + testCase["FAIL_TO_PASS"]
		const passToPassText =
			"These passing test cases sould continue to pass after your solution:\n" + testCase["PASS_TO_PASS"]
		const task =
			"You have to solve this problem in this repository:\n" +
			testCase["problem_statement"] +
			"\n\n" +
			failToPassText +
			"\n\n" +
			passToPassText

		await vscode.commands.executeCommand("kodu-claude-coder-main.startTask", task)

		// Watch for done.txt file being written
		// This is a hack to wait for the extension to finish
		const watcher = vscode.workspace.createFileSystemWatcher("**/done.txt")
		watcher.onDidCreate(() => {
			process.exit(0)
		})

		await new Promise((resolve) => setTimeout(resolve, 1000 * 60 * 5)) // Sleep for 5 minutes
	})
})
