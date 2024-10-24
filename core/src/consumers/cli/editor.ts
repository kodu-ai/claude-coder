import { IConsumer } from "@/interfaces"

// TODO: Improve
export class CliConsumer implements IConsumer {
	private visibleFiles: string[] = []
	private openTabs: string[] = []

	constructor() {
		// In a CLI environment, we might not have a concept of visible files or open tabs,
		// so we'll initialize these as empty arrays.
	}

	getVisibleFiles(): string[] {
		// In a CLI, we don't have a concept of "visible" files,
		// so we'll return the current array (which is empty by default)
		return this.visibleFiles
	}

	getOpenTabs(): string[] {
		// Similarly, we don't have "open tabs" in a CLI,
		// so we'll return the current array (which is empty by default)
		return this.openTabs
	}

	openFile(filePath: string): void {
		console.log(`Opening file: ${filePath}`)
	}

	// You might want to add methods to update these arrays if needed in your CLI application
	setVisibleFiles(files: string[]): void {
		this.visibleFiles = files
	}

	setOpenTabs(tabs: string[]): void {
		this.openTabs = tabs
	}
}
