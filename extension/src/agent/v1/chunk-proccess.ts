import { koduSSEResponse } from "../../shared/kodu"

type ChunkCallback = (chunk: koduSSEResponse) => Promise<void>

interface ChunkProcessorCallbacks {
	onImmediateEndOfStream: ChunkCallback
	onChunk: ChunkCallback
	onFinalEndOfStream: ChunkCallback
}

export class ChunkProcessor {
	private callbacks: ChunkProcessorCallbacks
	private endOfStreamReceived = false
	private lastChunk: koduSSEResponse | null = null

	constructor(callbacks: ChunkProcessorCallbacks) {
		this.callbacks = callbacks
	}

	async processStream(stream: AsyncGenerator<koduSSEResponse, any, unknown>) {
		for await (const chunk of stream) {
			// Store the last chunk for final processing
			this.lastChunk = chunk

			// Handle end of stream signals immediately
			if (chunk.code === 1 || chunk.code === -1) {
				this.endOfStreamReceived = true
				await this.callbacks.onImmediateEndOfStream(chunk)
				continue
			}

			// Process chunk synchronously
			if (chunk.code === 2) {
				await this.callbacks.onChunk(chunk)
			}
		}

		if (this.endOfStreamReceived && this.lastChunk) {
			await this.callbacks.onFinalEndOfStream(this.lastChunk)
		}
	}
}
