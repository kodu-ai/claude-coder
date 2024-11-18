// src/test/suite/extension.test.ts

import { before, suite, test } from "mocha"
import * as vscode from "vscode"

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

		let task = `
			We are currently solving the following issue within our repository. Here is the issue text:
			--- BEGIN ISSUE ---
			${problemStatement}
			--- END ISSUE ---
			Now, you're going to solve this issue on your own. When you're satisfied with all of the changes you've made, you can finally raise the attempt_completion tool. Not before that. 
			You cannot use any interactive session commands (e.g. vim) in this environment, but you can write scripts and run them. E.g. you can write a python script and then run it with "python <script_name>.py".
			I've already taken care of all changes to any of the test files described in the issue. This means you DON'T have to modify the testing logic or any of the tests in any way!\n"
			Your task is to make the minimal changes to non-tests files in the workspace directory to ensure the issue is satisfied.

			AVAILABLE TOOLS:
			- You have access to standard file operations (read, write, create, delete)
			- You can execute shell commands
			- You can use git commands
			- You CANNOT use web search tools - all solutions must come from your knowledge or the repository
			- Use list_files to explore directory contents
			- Use read_file to examine file contents

			NOTE ABOUT THE WRITE TO FILE TOOL: Indentation really matters! When editing a file, make sure to insert appropriate indentation before each line!

			IMPORTANT TIPS:
			1. Always start by trying to replicate the bug that the issues discusses.
					If the issue includes code for reproducing the bug, we recommend that you re-implement that in your environment, and run it to make sure you can reproduce the bug.
					Then start trying to fix it.
					When you think you've fixed the bug, re-run the bug reproduction script to make sure that the bug has indeed been fixed.

					If the bug reproduction script does not print anything when it successfully runs, we recommend adding a print("Script completed successfully, no errors.") command at the end of the file,
					so that you can be sure that the script indeed ran fine all the way through.

			2. If you run a command and it doesn't work, try running a different command. A command that did not work once will not work the second time unless you modify it!

			3. When editing files, it is easy to accidentally specify a wrong line number or to write code with incorrect indentation. Always check the code after you issue an edit to make sure that it reflects what you wanted to accomplish. If it didn't, issue another tool use to fix it.
		`
		await vscode.commands.executeCommand("kodu-claude-coder-main.startNewTask", task)

		await new Promise((resolve) => setTimeout(resolve, 1000 * 60 * 60 * 4))
		console.log("Timeout hit from extension test!")
	})
})
