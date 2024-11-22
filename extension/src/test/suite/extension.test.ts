import { before, suite, test } from "mocha"
import { env } from "process"
import * as vscode from "vscode"

if (!!env.isBenchmark) {
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
			const taskPrompt = await vscode.workspace.fs.readFile(
				vscode.Uri.file(folder + `./../../eval_data/00_problem_statements/${lastFolder}.txt`)
			)
			const parsedTask = JSON.parse(problemStatement.toString())
			console.log(`[DEBUG] Problem statement is the following: ${parsedTask["problem_statement"]}`)

			let task =
				taskPrompt.toString() +
				`
                Here is the PR Issue you must give it the most amount of attention possible:
                <pr_issue>
                ${parsedTask["problem_statement"]}
                </pr_issue>`

			console.log(`[DEBUG] Task is the following: ${task}`)

			const task2 = "Tell me what date is today using the execute command tool"

			console.log("Task started")
			console.log(task)
			await vscode.commands.executeCommand("kodu-claude-coder-main.startNewTask", task)

			await new Promise((resolve) => setTimeout(resolve, 1000 * 60 * 30)) // 20 minutes
			console.log("Timeout hit from extension test!")
		})
	})
}
