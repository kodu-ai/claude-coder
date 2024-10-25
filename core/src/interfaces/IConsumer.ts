import { TerminalManager } from "@/integrations"

export interface IConsumer {
	filesAdapter: IConsumerFilesAdapter

	get appPaths(): IAppPaths

	terminalManager: TerminalManager

	getDiagnostics(paths: string[]): { key: string; errorString: string | null }[]
}

export interface IAppPaths {
	binPaths: string[]

	appRoot: string
}

export interface IConsumerFilesAdapter {
	getVisibleFiles(relativeToCwd: boolean): string[]

	getOpenTabs(relativeToCwd: boolean): string[]

	openFile(absolutePath: string): void

	selectImages(): Promise<string[]>

	showDialogAndSaveFiles(
		folderPath: string,
		fileName: string,
		markdownContent: string,
		filters: Record<string, string[]>
	): Promise<boolean>
}

export interface IDiagnosticsHandler {
	getDiagnostics(paths: string[]): { key: string; errorString: string | null }[]
}
