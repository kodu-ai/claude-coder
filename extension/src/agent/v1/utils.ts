import * as path from "path"
import * as os from "os"
import * as vscode from "vscode"
import { Anthropic } from "@anthropic-ai/sdk"
import { ClaudeSayTool } from "../../shared/ExtensionMessage"

export const getCwd = (): string =>
	vscode.workspace.workspaceFolders?.map((folder) => folder.uri.fsPath).at(0) ?? path.join(os.homedir(), "Desktop")

export const cwd =
	vscode.workspace.workspaceFolders?.map((folder) => folder.uri.fsPath).at(0) ?? path.join(os.homedir(), "Desktop")
/**
 * Get a readable path for display purposes
 * @param relPath - The relative path to convert
 * @param customCwd - Custom current working directory (optional)
 * @returns A readable path string
 */
export function getReadablePath(relPath: string, customCwd: string = cwd): string {
	const absolutePath = path.resolve(customCwd, relPath)
	if (customCwd === path.join(os.homedir(), "Desktop")) {
		return absolutePath
	}
	if (path.normalize(absolutePath) === path.normalize(customCwd)) {
		return path.basename(absolutePath)
	} else {
		const normalizedRelPath = path.relative(customCwd, absolutePath)
		if (absolutePath.includes(customCwd)) {
			return normalizedRelPath
		} else {
			return absolutePath
		}
	}
}

/**
 * Format a list of files for display
 * @param absolutePath - The absolute path of the directory
 * @param files - Array of file paths
 * @returns Formatted string of file list
 */
export function formatFilesList(absolutePath: string, files: string[]): string {
	const sorted = files
		.map((file) => {
			const relativePath = path.relative(absolutePath, file)
			return file.endsWith("/") ? relativePath + "/" : relativePath
		})
		.sort((a, b) => {
			const aIsDir = a.endsWith("/")
			const bIsDir = b.endsWith("/")
			if (aIsDir !== bIsDir) {
				return aIsDir ? -1 : 1
			}
			return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
		})

	if (sorted.length > 1000) {
		const truncatedList = sorted.slice(0, 1000).join("\n")
		const remainingCount = sorted.length - 1000
		return `${truncatedList}\n\n(${remainingCount} files not listed due to automatic truncation. Try listing files in subdirectories if you need to explore further.)`
	} else if (sorted.length === 0 || (sorted.length === 1 && sorted[0] === "")) {
		return "No files found or you do not have permission to view this directory."
	} else {
		return sorted.join("\n")
	}
}

/**
 * Get potentially relevant details for the AI
 * @returns A string containing relevant VSCode details
 */
export function getPotentiallyRelevantDetails(): string {
	return `<potentially_relevant_details>
VSCode Visible Files: ${
		vscode.window.visibleTextEditors
			?.map((editor) => editor.document?.uri?.fsPath)
			.filter(Boolean)
			.join(", ") || "(No files open)"
	}
VSCode Opened Tabs: ${
		vscode.window.tabGroups.all
			.flatMap((group) => group.tabs)
			.map((tab) => (tab.input as vscode.TabInputText)?.uri?.fsPath)
			.filter(Boolean)
			.join(", ") || "(No tabs open)"
	}
</potentially_relevant_details>`
}

/**
 * Format images into Anthropic image blocks
 * @param images - Array of image data URLs
 * @returns Array of Anthropic image blocks
 */
export function formatImagesIntoBlocks(images?: string[]): Anthropic.ImageBlockParam[] {
	return images
		? images.map((dataUrl) => {
				const [rest, base64] = dataUrl.split(",")
				const mimeType = rest.split(":")[1].split(";")[0]
				return {
					type: "image",
					source: { type: "base64", media_type: mimeType, data: base64 },
				} as Anthropic.ImageBlockParam
		  })
		: []
}

/**
 * Format a tool response
 * @param text - The text response
 * @param images - Optional array of image data URLs
 * @returns Formatted tool response
 */
export function formatToolResponse(
	text: string,
	images?: string[]
): string | Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam> {
	if (images && images.length > 0) {
		const textBlock: Anthropic.TextBlockParam = { type: "text", text }
		const imageBlocks: Anthropic.ImageBlockParam[] = formatImagesIntoBlocks(images)
		return [textBlock, ...imageBlocks]
	} else {
		return text
	}
}

/**
 * Format generic tool feedback
 * @param feedback - The feedback text
 * @returns Formatted feedback string
 */
export function formatGenericToolFeedback(feedback?: string): string {
	return `The user denied this operation and provided the following feedback:\n<feedback>\n${feedback}\n</feedback>\n\n${getPotentiallyRelevantDetails()}`
}

/**
 * Create a tool message for Claude
 * @param tool - The tool name
 * @param path - The path (if applicable)
 * @param content - The content
 * @param customCwd - Custom current working directory (optional)
 * @returns Formatted tool message
 */
export function createToolMessage(tool: string, path: string, content: string, customCwd: string = cwd): string {
	return JSON.stringify({
		tool,
		path: getReadablePath(path, customCwd),
		content,
	} as ClaudeSayTool)
}
