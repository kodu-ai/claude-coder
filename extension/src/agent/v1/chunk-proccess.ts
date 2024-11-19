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
	private readonly QUEUE_BATCH_SIZE = 5
	private readonly QUEUE_PROCESS_DELAY = 5

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
			await new Promise((resolve) => setTimeout(resolve, 5))
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
		
		// Process chunks in batches
		const chunks = this.chunkQueue.splice(0, Math.min(this.QUEUE_BATCH_SIZE, this.chunkQueue.length))

		try {
			// Process chunks in sequence but with minimal delay
			for (const chunk of chunks) {
				await this.callbacks.onChunk(chunk)
				await new Promise(resolve => setTimeout(resolve, this.QUEUE_PROCESS_DELAY))
			}
		} catch (error) {
			console.error("Error processing chunks:", error)
		} finally {
			this.isProcessing = false
			if (this.chunkQueue.length > 0) {
				this.processNextChunk()
			}
		}
	}
}
