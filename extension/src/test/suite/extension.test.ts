import { before, suite, test } from "mocha"
import * as vscode from "vscode"

suite("Extension Test Suite", () => {
	let extension: vscode.Extension<any>

	before(async () => {
		extension = vscode.extensions.getExtension("kodu-ai.claude-dev-experimental")!
		await extension.activate()

		await new Promise((resolve) => setTimeout(resolve, 5000))
	})

	test("Setup", async () => {
		console.log(">>>> Starting setup test")
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
			Task is the following: We are currently solving an issue within our repository, we have a <pr_issue> that contains the full details about the problem and the requirements to fix it.
Your instructions are to replicate this github issue on your own by figuring out what is going wrong and create a reproduce_bug.py script that can be used to reproduce the issue.
You cannot use any interactive session commands (e.g. vim) in this environment, but you can write scripts and run them. E.g. you can write a python3 script and then run it with "python3 <script_name>.py".
I've already taken care of all changes to any of the test files described in the issue. This means you DON'T have to modify the testing logic or any of the tests in any way!
I have also already installed all dependencies for you and setup the basic repo config.
Your task is to only make the reproduce_bug.py script and ensure the issue is replicates the issue with thoughtful thinking process.

NOTE ABOUT THE WRITE TO FILE TOOL: Indentation really matters! When editing a file, make sure to insert appropriate indentation before each line!
NOTE ABOUT TOOLS: The ask_followup_question tool is disabled for you, you have to do the research yourself, I will not answer any followup questions.
NOTE ABOUT TOOLS: The web_search tool is disabled for you, you are unable to use it.
NOTE YOU CANNOT CHANGE OR DELETE TEST CASES YOU CAN ONLY CREATE REPROUDCTION SCRIPT FOR PERSONAL USE NO TOUCHING IN ANY TEST SUITE CASE AT ALL!

Here is a good guideline to follow to resolve the issue it should set you up with a good framework:
1. As a first step, it is a good idea to explore the repo to familiarize yourself with its structure, files, test cases and understand the issue at hand and where it might be located in the repo codebase.
2. immediately after that, you should find how to run the test suite and run it once to see the current state of the codebase and to confirm that the issue is present, you should get a failing test, you can maybe add the failing test to the reproduce_bug.py script.
3. Create a reproduce_bug.py script to reproduce the error and execute it with \`python3 reproduce_bug.py\` using the execute command tool to confirm the error. run the command and verify that the error occurs and start working your way from there to fix the <pr_issue>.
6. Think about edge cases and make sure your fix handles them as well, you must red team your fix to make sure it's robust and didn't break other part of the codebase.
7. Double check that you haven't accidentally changed any other files or code that is not related to the issue. If you did, go back to the original state of the files and only make the minimal changes needed to fix the issue, your goal is to only solve <pr_issue> nothing else nothing more, you're working on step at a time!.
8. When you're done and you have checked twice that your bug reproduction script runs without errors, you should run the test suite again to make sure that your fix didn't break anything else and you can compare it again by using your kodu-journal.md (if exists).
9. if your test suite runs without new errors and resolving the <pr_issue> problem , you can raise the attempt_completion tool to let the user know that you're ready for review.

an example of a bad testing flow:
read the issue
create the reproduce_bug.py script
end

an example of a bad testing flow:
read the issue
explore the connected logic and files and understand the issue at hand
run the test suite, figure out what is failing
create the reproduce_bug.py script
end


IMPORTANT GUIDELINES:
Always start by trying to replicate the bug that the issues discusses.
		If the issue includes code for reproducing the bug, we recommend that you re-implement that in your environment, and run it to make sure you can reproduce the bug.
		Then start trying to fix it.
		When you think you've fixed the bug, re-run the bug reproduction script to make sure that the bug has indeed been fixed.

			Here is the PR Issue you must give it the most amount of attention possible, and crete reproduce_bug.py script ot replicate it:
			<pr_issue>
			${parsedTask["problem_statement"]}
			</pr_issue>`

		console.log(`[DEBUG] Task is the following: ${task}`)

		console.log("Task started")
		console.log(task)
		await vscode.commands.executeCommand("kodu-claude-coder-main.startNewTask", task)

		await new Promise((resolve) => setTimeout(resolve, 1000 * 60 * 10)) // 5 minutes
		console.log("Timeout hit from setup test!")
	})

	test("Execution", async () => {
		console.log(">>>> Starting execution test")
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

		await new Promise((resolve) => setTimeout(resolve, 1000 * 60 * 30)) // 30 minutes
		console.log("Timeout hit from extension test!")
	})
})
