// src/test/suite/extension.test.ts

import * as assert from "assert"
import * as vscode from "vscode"
import { after, before } from "mocha"
import { suite, test } from "mocha"

suite("Extension Test Suite", () => {
	let extension: vscode.Extension<any>

	before(async () => {
		// Activate the extension before running tests
		extension = vscode.extensions.getExtension("kodu-ai.claude-dev-experimental")!
		await extension.activate()
		await new Promise((resolve) => setTimeout(resolve, 10000)) // Sleep for 60 seconds

		//kodu-ai.claude-dev-experimental?token=

		cursor: console.log("extension", extension)
	})

	test("All commands are registered", async () => {
		const commands = await vscode.commands.getCommands(true)
		const expectedCommands = [
			"kodu-claude-coder-main.plusButtonTapped",
			"kodu-claude-coder-main.popoutButtonTapped",
			"kodu-claude-coder-main.openInNewTab",
			"kodu-claude-coder-main.settingsButtonTapped",
			"kodu-claude-coder-main.historyButtonTapped",
			"kodu-claude-coder-main.startTask",
			// Add other commands you expect to be registered
		]

		expectedCommands.forEach((command) => {
			assert.ok(commands.includes(command), `Command ${command} is not registered.`)
		})

		// const result = await vscode.commands.executeCommand(
		// 	"kodu-claude-coder-main.startTask",
		// 	"can you give me the result 2 + 7"
		// )
		const result = await vscode.commands.executeCommand(
			"kodu-claude-coder-main.startTask",
			"can you give me the result 2 + 7"
		)
		console.log("result", result)

		await new Promise((resolve) => setTimeout(resolve, 100000)) // Sleep for 60 seconds
	})
})
