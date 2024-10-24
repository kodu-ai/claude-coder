export interface IConsumer {
	getVisibleFiles(): string[]
	getOpenTabs(): string[]
	openFile(absolutePath: string): void
}
