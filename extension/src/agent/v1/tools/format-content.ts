import * as path from 'path';
import * as vscode from "vscode";
import { Resource } from "../../../shared/WebviewMessage";

async function readFile(fileName: string): Promise<string> {
	const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
	if (!workspaceFolder) {
			throw new Error('No workspace folder is open');
	}

	const filePath = path.join(workspaceFolder.uri.fsPath, fileName);
	const fileUri = vscode.Uri.file(filePath);
	const fileContent = await vscode.workspace.fs.readFile(fileUri);
	return Buffer.from(fileContent).toString('utf8');
}


/**
 * Reads all files and folders mentioned in argument
 * @param resources - Array of either file, folder or url, each represented as a string
 * @returns Array of Anthropic.Message
 */
export async function formatResourcesIntoBlocks(resources?: Resource[]): Promise<string> {
	if (!resources || resources.length === 0) {
		return ""
	}

	const additionalContextFiles: string[] = []
	const additionalScrappedUrls: string[] = []

	for (const resource of resources || []) {
		console.debug(`[DEBUG] Iterating over the resources: ${resource}`)
		if (resource.type === "file") {
			// Prepend `./` to the file path
			const fileContent = await readFile(resource.id);
			additionalContextFiles.push(`<file path="${resource.id}">${fileContent}</file>`)
		} else if (resource.type === "url") {
			// additionalScrappedUrls.push({
			// 	url: resource.id,
			// 	name: resource.name,
			// })
		}
	}
	const additionalFilesContext = `<files count="${additionalContextFiles.length}">${additionalContextFiles.join("\n")}</files>`
	return `
	<additional-context>
		${additionalFilesContext}
	</additional-context>
	`
}
