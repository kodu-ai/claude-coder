import type { koduSSEResponse } from '../shared/kodu'

export function createStreamDebouncer(callback: (chunks: koduSSEResponse[]) => Promise<void>, delay = 25) {
	let timeoutId: NodeJS.Timeout | null = null
	let chunks: koduSSEResponse[] = []
	let isProcessing = false

	const processChunks = async () => {
		isProcessing = true

		// Capture the current chunks and reset the accumulator
		const chunksToProcess = chunks
		chunks = []

		try {
			await callback(chunksToProcess)
		} catch (error) {
			console.error('Error processing chunks:', error)
			console.error('Problematic chunks:', JSON.stringify(chunksToProcess, null, 2))
		} finally {
			isProcessing = false
			// If new chunks arrived during processing, schedule another processing
			if (chunks.length > 0) {
				timeoutId = setTimeout(processChunks, delay)
			}
		}
	}

	return {
		add: (chunk: koduSSEResponse) => {
			chunks.push(chunk)

			// Clear any existing timeout to debounce
			if (timeoutId) {
				clearTimeout(timeoutId)
			}

			// If not already processing, schedule processing
			if (!isProcessing) {
				timeoutId = setTimeout(processChunks, delay)
			}
		},
		flush: async () => {
			// Clear any pending timeout to ensure immediate processing
			if (timeoutId) {
				clearTimeout(timeoutId)
				timeoutId = null
			}

			// If there are chunks and not currently processing, process them immediately
			if (chunks.length > 0 && !isProcessing) {
				await processChunks()
			}

			// Wait until any ongoing processing completes
			while (isProcessing) {
				await new Promise((resolve) => setTimeout(resolve, delay))
			}
		},
	}
}
