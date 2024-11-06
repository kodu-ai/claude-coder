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
		// Read problem statement file
		const fs = require("fs")
		const problemStatement = fs.readFileSync("../problem_statement.txt", "utf8")
		console.log("Problem statement:", problemStatement)

		const result = await vscode.commands.executeCommand("kodu-claude-coder-main.startTask", problemStatement)
		console.log("result", result)

		// await new Promise((resolve) => setTimeout(resolve, 100000)) // Sleep for 60 seconds
	})
})
