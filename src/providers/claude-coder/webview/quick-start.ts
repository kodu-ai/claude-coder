import * as vscode from "vscode"
import * as fs from "fs"
import * as path from "path"

type newTaskCallback = (description: string) => void

export async function quickStart(repoUrl: string, name: string, newTask: newTaskCallback): Promise<void> {
	console.log("Quickstart", repoUrl, name)

	let workspaceFolder = await getWorkspaceFolder()
	if (!workspaceFolder) {
		return
	}

	name = (await ensureUniqueFolderName(workspaceFolder, name!)) as string
	if (!name) {
		return
	}

	const { repoFullName, branch, subdir } = parseGitHubUrl(repoUrl)
	if (!repoFullName) {
		vscode.window.showErrorMessage("Invalid GitHub URL")
		return
	}

	const task = createCloneTask(workspaceFolder, repoFullName, branch, name)

	try {
		await executeTaskWithFeedback(task)

		if (subdir) {
			await moveSubdirContents(workspaceFolder, name, subdir)
		}

		const uri = vscode.Uri.joinPath(workspaceFolder.uri, name)

		// Create a new task with the description
		await newTask(`Let's build project ${name}!`)

		// Open the cloned repository in current window
		await vscode.commands.executeCommand("vscode.openFolder", uri, {
			forceNewWindow: false,
			forceReuseWindow: true,
		})

		vscode.window.showInformationMessage(
			"Repository cloned successfully. The extension's webview should open shortly."
		)
	} catch (err) {
		vscode.window.showErrorMessage(`Error cloning repository: ${(err as Error).message}`)
	}
}

async function getWorkspaceFolder(): Promise<vscode.WorkspaceFolder | undefined> {
	let workspaceFolder = vscode.workspace.workspaceFolders?.[0]
	if (!workspaceFolder) {
		vscode.window.showWarningMessage("No workspace folder selected. Please choose a folder to clone into.")
		workspaceFolder = await vscode.window.showWorkspaceFolderPick()
		if (!workspaceFolder) {
			vscode.window.showErrorMessage("No workspace folder selected. Operation cancelled.")
			return undefined
		}
	}
	return workspaceFolder
}

async function ensureUniqueFolderName(
	workspaceFolder: vscode.WorkspaceFolder,
	initialName: string
): Promise<string | undefined> {
	let name = initialName
	const folderPath = path.join(workspaceFolder.uri.fsPath, name)

	while (fs.existsSync(folderPath)) {
		const response = await vscode.window.showInputBox({
			prompt: `Folder "${name}" already exists. Please enter a different name:`,
			value: name,
		})

		if (!response) {
			vscode.window.showInformationMessage("Operation cancelled by user.")
			return undefined
		}

		name = response
	}

	return name
}

function parseGitHubUrl(url: string): { repoFullName: string | null; branch: string; subdir: string | null } {
	const githubRegex = /^https:\/\/github\.com\/([^/]+\/[^/]+)(\/tree\/([^/]+))?(\/(.*))?$/
	const match = url.match(githubRegex)
	if (match) {
		return {
			repoFullName: match[1],
			branch: match[3] || "main",
			subdir: match[5] || null,
		}
	}
	return { repoFullName: null, branch: "main", subdir: null }
}

function createCloneTask(
	workspaceFolder: vscode.WorkspaceFolder,
	repoFullName: string,
	branch: string,
	name: string
): vscode.Task {
	const cloneUrl = `https://github.com/${repoFullName}.git`
	return new vscode.Task(
		{ type: "shell" },
		workspaceFolder,
		"Clone Repository",
		"git",
		new vscode.ShellExecution(`git clone -b ${branch} "${cloneUrl}" "${name}"`),
		[]
	)
}

async function executeTaskWithFeedback(task: vscode.Task): Promise<void> {
	return new Promise<void>((resolve, reject) => {
		let disposable: vscode.Disposable

		disposable = vscode.tasks.onDidEndTaskProcess((e) => {
			if (e.execution.task === task) {
				disposable.dispose()
				if (e.exitCode === 0) {
					resolve()
				} else {
					reject(new Error(`Task failed with exit code ${e.exitCode}`))
				}
			}
		})

		vscode.tasks.executeTask(task).then(null, reject)
	})
}

async function moveSubdirContents(
	workspaceFolder: vscode.WorkspaceFolder,
	name: string,
	subdir: string
): Promise<void> {
	const repoPath = path.join(workspaceFolder.uri.fsPath, name)
	const subdirPath = path.join(repoPath, subdir)
	const tempPath = path.join(repoPath, "_temp_move")

	await vscode.workspace.fs.rename(vscode.Uri.file(subdirPath), vscode.Uri.file(tempPath))

	for (const entry of await vscode.workspace.fs.readDirectory(vscode.Uri.file(repoPath))) {
		if (entry[0] !== ".git" && entry[0] !== "_temp_move") {
			await vscode.workspace.fs.delete(vscode.Uri.joinPath(vscode.Uri.file(repoPath), entry[0]), {
				recursive: true,
			})
		}
	}

	for (const entry of await vscode.workspace.fs.readDirectory(vscode.Uri.file(tempPath))) {
		await vscode.workspace.fs.rename(
			vscode.Uri.joinPath(vscode.Uri.file(tempPath), entry[0]),
			vscode.Uri.joinPath(vscode.Uri.file(repoPath), entry[0])
		)
	}

	await vscode.workspace.fs.delete(vscode.Uri.file(tempPath), { recursive: true })
}
