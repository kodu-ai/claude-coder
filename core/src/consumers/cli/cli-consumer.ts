import { IConsumer } from "@/interfaces"
import { IAppPaths, IConsumerFilesAdapter } from "@/interfaces/IConsumer"

// TODO: Improve
export class CliFilesAdapter implements IConsumerFilesAdapter {
	private visibleFiles: string[] = []
	private openTabs: string[] = []

	constructor() {}

	getVisibleFiles(relativeToCwd: boolean = true): string[] {
		return this.visibleFiles
	}

	getOpenTabs(relativeToCwd: boolean = true): string[] {
		return this.openTabs
	}

	openFile(filePath: string): void {
		console.log(`Opening file: ${filePath}`)
	}

	async selectImages(): Promise<string[]> {
		return []
	}

	async showDialogAndSaveFiles(
		folderPath: string,
		fileName: string,
		markdownContent: string,
		filters: Record<string, string[]>
	): Promise<boolean> {
		return true
	}

	// Non interface sutff

	private setVisibleFiles(files: string[]): void {
		this.visibleFiles = files
	}

	private setOpenTabs(tabs: string[]): void {
		this.openTabs = tabs
	}
}

export class CliConsumer implements IConsumer {
	filesAdapter: CliFilesAdapter = new CliFilesAdapter()

	get appPaths(): IAppPaths {
		return {
			appRoot: process.cwd(),
			binPaths: [],
		}
	}
}
