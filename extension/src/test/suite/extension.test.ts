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

	test("Extension Test", async () => {
		// blackmagicfuckery, but works
		const folder = vscode.workspace.workspaceFolders?.map((folder) => folder.uri.fsPath).at(0)
		const lastFolder = folder?.split("/").at(-1)

		const problemStatement = await vscode.workspace.fs.readFile(
			vscode.Uri.file(folder + `./../../eval_data/00_problem_statements/${lastFolder}.json`)
		)
		const testCase = JSON.parse(problemStatement.toString())

		const failToPassText =
			"These failing test cases would pass if the problem is resolved:\n" + testCase["FAIL_TO_PASS"] + "\n\n"
		;("If these failing test cases dont exist in the repository, you can create them.")
		const passToPassText =
			"These passing test cases sould continue to pass after your solution:\n" + testCase["PASS_TO_PASS"]

		const task =
			"You are tasked to solve this problem in the current repository:\n" +
			testCase["problem_statement"] +
			"\n\n" +
			"The repository is in python, you should setup the repository first before proceeding." +
			"\n\n" +
			failToPassText +
			"You can look for the any failing test, or you can try to create a test that might fail as per the problem."

		// const task =
		// 	"can you write a short poem about js in JS.txt and another poem about python in Python.txt and antoehr in TS for Ts.txt"
		await vscode.commands.executeCommand("kodu-claude-coder-main.startNewTask", task)

		await new Promise((resolve) => setTimeout(resolve, 1000 * 60 * 60 * 4))
		console.log("Timeout hit from extension test!")
	})
})
