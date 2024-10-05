import { koduSSEResponse } from "../../shared/kodu"

type ChunkCallback = (chunk: koduSSEResponse) => Promise<void>

interface ChunkProcessorCallbacks {
	onImmediateEndOfStream: ChunkCallback
	onChunk: ChunkCallback
	onFinalEndOfStream: ChunkCallback
}

export class ChunkProcessor {
	private callbacks: ChunkProcessorCallbacks
	private chunkQueue: koduSSEResponse[] = []
	private isProcessing = false
	private endOfStreamReceived = false

	constructor(callbacks: ChunkProcessorCallbacks) {
		this.callbacks = callbacks
	}

	async processStream(stream: AsyncGenerator<koduSSEResponse, any, unknown>) {
		for await (const chunk of stream) {
			if (chunk.code === 1 || chunk.code === -1) {
				this.endOfStreamReceived = true
				await this.callbacks.onImmediateEndOfStream(chunk)
			}

			this.chunkQueue.push(chunk)
			this.processNextChunk()
		}

		// Ensure final processing occurs after all chunks have been processed
		while (this.isProcessing || this.chunkQueue.length > 0) {
			await new Promise((resolve) => setTimeout(resolve, 10))
		}

		if (this.endOfStreamReceived) {
			const lastChunk = this.chunkQueue[this.chunkQueue.length - 1]
			await this.callbacks.onFinalEndOfStream(lastChunk)
		}
	}

	private async processNextChunk() {
		if (this.isProcessing || this.chunkQueue.length === 0) {
			return
		}

		this.isProcessing = true
		const chunk = this.chunkQueue.shift()!

		try {
			await this.callbacks.onChunk(chunk)
		} catch (error) {
			console.error("Error processing chunk:", error)
		} finally {
			this.isProcessing = false
			this.processNextChunk()
		}
	}
}
