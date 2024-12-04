import { before, suite, test } from "mocha"
import { env } from "process"
import * as vscode from "vscode"
import * as path from "path"

suite("Extension Test Suite", () => {
	let extension: vscode.Extension<any>

	before(async () => {
		// Activate your extension
		extension = vscode.extensions.getExtension("kodu-ai.claude-dev-experimental")!
		await extension.activate()

		try {
			// Check if Python extension is installed
			let pythonExtension = vscode.extensions.getExtension("ms-python.python")
			if (!pythonExtension) {
				console.log("Installing Python extension...")
				await vscode.commands.executeCommand("workbench.extensions.installExtension", "ms-python.python")
				console.log("Waiting for Python extension installation...")
				await new Promise((resolve) => setTimeout(resolve, 5000))
				pythonExtension = vscode.extensions.getExtension("ms-python.python")
				if (!pythonExtension) {
					throw new Error("Failed to install Python extension")
				}
			}

			// Activate Python extension if not already active
			if (!pythonExtension.isActive) {
				await pythonExtension.activate()
			}
			console.log("Python extension installed and activated successfully")

			// Install and activate Pylance
			let pylanceExtension = vscode.extensions.getExtension("ms-python.vscode-pylance")
			if (!pylanceExtension) {
				console.log("Installing Pylance extension...")
				await vscode.commands.executeCommand(
					"workbench.extensions.installExtension",
					"ms-python.vscode-pylance"
				)
				await new Promise((resolve) => setTimeout(resolve, 5000))
				pylanceExtension = vscode.extensions.getExtension("ms-python.vscode-pylance")
				if (!pylanceExtension) {
					throw new Error("Failed to install Pylance extension")
				}
			}

			// Activate Pylance if not already active
			if (!pylanceExtension.isActive) {
				await pylanceExtension.activate()
			}

			// Configure Python to use Pylance
			await vscode.workspace.getConfiguration().update("python.languageServer", "Pylance", true)

			console.log("Setup completed successfully - LSP is ready")
		} catch (error) {
			console.error("Error during setup:", error)
			throw error // Re-throw to fail the test
		}
	})

	test("Extension Test", async () => {
		const folder = vscode.workspace.workspaceFolders?.map((folder) => folder.uri.fsPath).at(0)
		const lastFolder = folder?.split("/").at(-1)

		const problemStatement = await vscode.workspace.fs.readFile(
			vscode.Uri.file(path.join(folder!, `./../../eval_data/00_problem_statements/${lastFolder}.json`))
		)
		const taskPrompt = await vscode.workspace.fs.readFile(
			vscode.Uri.file(path.join(folder!, `./../../eval_data/00_problem_statements/${lastFolder}.txt`))
		)

		const parsedTask = JSON.parse(problemStatement.toString())
		console.log(`[DEBUG] Problem statement is the following: ${parsedTask["problem_statement"]}`)

		let task = `
${taskPrompt.toString()}
Here is the PR Issue you must give it the most amount of attention possible:
<pr_issue>
${parsedTask["problem_statement"]}
</pr_issue>`.trim()

		console.log(`[DEBUG] Task is the following: ${task}`)
		console.log("Task started")

		await vscode.commands.executeCommand("kodu-claude-coder-main.startNewTask", task)

		await new Promise((resolve) => setTimeout(resolve, 1000 * 60 * 30))
		console.log("Timeout hit from extension test!")
	})
})
