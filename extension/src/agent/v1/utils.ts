import * as path from "path"
import * as os from "os"
import * as vscode from "vscode"
import { Anthropic } from "@anthropic-ai/sdk"
import { ClaudeMessage, ClaudeSayTool } from "../../shared/messages/extension-message"
import "../../utils/path-helpers"
import { lstat } from "fs/promises"
declare global {
	interface String {
		toPosix(): string
	}
}

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

interface FolderMeta {
	files: Set<string>
	subfolders: Set<string>
}

interface FolderListing {
	folderPath: string // e.g. "azad", or "" for root
	files: string[] // direct files in this folder
	subfolders: string[] // direct subfolder names
}

/**
 * Format a list of files for display in a depth-first "folder: ..." style
 * @param absolutePath - The absolute path of the directory
 * @param files - Array of absolute file paths (no guaranteed trailing slash)
 * @param didHitLimit - If we truncated the list due to a file limit
 * @returns A string showing depth-first folder listings
 */
export async function formatFilesList(absolutePath: string, files: string[], didHitLimit: boolean): Promise<string> {
	// Helper to convert Windows backslashes to forward slashes
	function toPosix(p: string): string {
		return p.replace(/\\/g, "/")
	}

	// If no files at all, return "No files found."
	if (!files || files.length === 0) {
		return "No files found."
	}

	// Map of folderPath => { files: Set, subfolders: Set }
	const folderMap = new Map<string, FolderMeta>()

	// ---------------------------------------------
	// 1. Build the folderMap from the file paths
	// ---------------------------------------------
	for (const fullPath of files) {
		// Convert absolute path to relative (to absolutePath), then to posix style
		const rel = toPosix(path.relative(absolutePath, fullPath))
		if (!rel) {
			continue
		} // Edge case: if same path as absolutePath

		// Check if it's actually a directory, ignoring any trailing slash
		let isDir = rel.endsWith("/")
		const normalized = isDir ? rel.slice(0, -1) : rel // remove trailing slash if present

		try {
			if (!isDir) {
				// If we didn't detect a trailing slash, check via lstat
				const stats = await lstat(fullPath)
				if (stats.isDirectory()) {
					isDir = true
				}
			}
		} catch (err) {
			// If lstat fails (e.g. broken symlink), treat as file or skip
			// console.warn(`lstat failed for ${fullPath}:`, err);
		}

		// Split out parent directory and last segment
		const segments = normalized.split("/")
		const lastSegment = segments[segments.length - 1]
		const parentFolder = segments.length > 1 ? segments.slice(0, -1).join("/") : ""

		// Ensure the parent folder entry exists
		if (!folderMap.has(parentFolder)) {
			folderMap.set(parentFolder, { files: new Set(), subfolders: new Set() })
		}

		if (isDir) {
			// Also ensure this directory has an entry in folderMap
			if (!folderMap.has(normalized)) {
				folderMap.set(normalized, { files: new Set(), subfolders: new Set() })
			}
			folderMap.get(parentFolder)!.subfolders.add(lastSegment)
		} else {
			// It's a file
			folderMap.get(parentFolder)!.files.add(lastSegment)
		}
	}

	// ---------------------------------------------
	// 2. Depth-first traversal (DFS) over folderMap
	// ---------------------------------------------
	const visited = new Set<string>()
	const listings: FolderListing[] = []

	function dfs(folderPath: string): void {
		if (visited.has(folderPath)) {
			return
		}
		visited.add(folderPath)

		const meta = folderMap.get(folderPath)
		if (!meta) {
			return
		}

		// Sort files + subfolders alphabetically
		const sortedFiles = Array.from(meta.files).sort()
		const sortedSubfolders = Array.from(meta.subfolders).sort()

		listings.push({
			folderPath,
			files: sortedFiles,
			subfolders: sortedSubfolders,
		})

		// Recursively visit subfolders in alphabetical order
		for (const sub of sortedSubfolders) {
			const childPath = folderPath ? `${folderPath}/${sub}` : sub // handle root
			dfs(childPath)
		}
	}

	// Start DFS from the "root" folder path = ""
	if (!folderMap.has("")) {
		// If no "" key, create one so there's a top-level container
		folderMap.set("", { files: new Set(), subfolders: new Set() })
	}
	dfs("")

	// ---------------------------------------------
	// 3. Build output string
	// ---------------------------------------------
	const lines: string[] = []

	for (const { folderPath, files: fileList, subfolders } of listings) {
		// If folderPath == "", use the basename of absolutePath
		const label = folderPath === "" ? path.basename(absolutePath) || absolutePath : folderPath

		lines.push(`Folder: ${label}`)

		// Print each file
		for (const f of fileList) {
			lines.push(`  ${f}`)
		}

		// Print subfolders with trailing slash
		for (const s of subfolders) {
			lines.push(`  ${s}/`)
		}

		lines.push("") // blank line after each folder
	}

	// Remove trailing blank lines
	while (lines.length && !lines[lines.length - 1].trim()) {
		lines.pop()
	}

	// If we still have no content, say "No files found."
	if (lines.length === 0) {
		return "No files found."
	}

	// If truncated, append the limit message
	if (didHitLimit) {
		lines.push('(File limit reached. Use "list_files <folder>" to explore further.)')
	}

	return lines.join("\n")
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
 * Format a tool response block of text
 * @param toolName - The tool name
 * @param params - The parameters
 * @returns <t
 */
export function formatToolResponseText(toolName: string, params: Record<string, string>): string {
	// we convert the object to XML-like format for readability
	const formattedParams = Object.entries(params)
		.map(([key, value]) => `<${key}>${value}</${key}>`)
		.join("\n")
	return `Tool response for: ${toolName}\n
		<tool_response toolName="${toolName}">\n${formattedParams}\n</tool_response>`
}

/**
 * Format generic tool feedback
 * @param feedback - The feedback text
 * @returns Formatted feedback string
 */
export function formatGenericToolFeedback(feedback?: string): string {
	return `The user denied this operation and provided the following feedback:\n<feedback>\n${feedback}\n</feedback>`
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

export const isTextBlock = (block: any): block is Anthropic.TextBlockParam => {
	if (typeof block === "object") {
		return block.type === "text"
	}
	return false
}

export const isImageBlock = (block: any): block is Anthropic.ImageBlockParam => {
	if (typeof block === "object") {
		return block.type === "image"
	}
	return false
}
