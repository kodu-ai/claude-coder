import * as path from "path"
import { AdapterTextDocument } from "./interfaces"

export interface BaseAdapter {
	showTextDocument(filePath: string, options?: { preview: boolean }): Promise<void>
	executeCommand(command: string, ...args: any[]): Promise<void>
	showDiffView(originalUri: string, originalContent: string, tempFilePath: string, title: string): Promise<void>
	closeDiffViews(): Promise<void>
	getWorkspaceTextDocuments(): AdapterTextDocument[]

	// File operations
	pathUtil(): typeof path
	readFile(path: string, encoding: string): Promise<string>
	writeFile(path: string, data: string, options?: { encoding?: string; flag?: string }): Promise<void>
	access(path: string): Promise<boolean>
	mkdir(path: string, options: { recursive: boolean }): Promise<void>
	rmdir(path: string, options: { recursive: boolean; force: boolean }): Promise<void>
	createTempDir(path: string): Promise<string>
}
