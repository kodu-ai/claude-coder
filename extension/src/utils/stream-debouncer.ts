import { koduSSEResponse } from "../shared/kodu"

// Dynamic delay based on token count
const getDynamicDelay = (tokenCount: number): number => {
    if (tokenCount > 50000) return 100;
    if (tokenCount > 10000) return 50;
    return 25;
};

// Dynamic batch size based on token count
const getDynamicBatchSize = (tokenCount: number): number => {
    if (tokenCount > 50000) return 5000;
    if (tokenCount > 10000) return 1000;
    return 100;
};

export function createStreamDebouncer(callback: (chunks: koduSSEResponse[]) => Promise<void>, initialDelay: number = 25) {
    let timeoutId: NodeJS.Timeout | null = null;
    let chunks: koduSSEResponse[] = [];
    let isProcessing = false;
    let totalTokens = 0;

    const processChunks = async () => {
        isProcessing = true;

        // Calculate current token count and adjust delay/batch size
        const currentDelay = getDynamicDelay(totalTokens);
        const batchSize = getDynamicBatchSize(totalTokens);

        // Process chunks in batches
        while (chunks.length > 0) {
            const chunksToProcess = chunks.splice(0, batchSize);
            try {
                await callback(chunksToProcess);
            } catch (error) {
                console.error("Error processing chunks:", error);
                console.error("Problematic chunks:", JSON.stringify(chunksToProcess, null, 2));
            }
        }

        isProcessing = false;
        // Schedule next batch if there are new chunks
        if (chunks.length > 0) {
            timeoutId = setTimeout(processChunks, currentDelay);
        }
    };

    return {
        add: (chunk: koduSSEResponse) => {
            chunks.push(chunk);
            // Update total token count
            if (chunk.text) {
                // Rough estimation of tokens (can be refined based on actual tokenization)
                totalTokens += chunk.text.length / 4;
            }

            // Clear existing timeout to debounce
            if (timeoutId) {
                clearTimeout(timeoutId);
            }

            // If not processing, schedule next batch
            if (!isProcessing) {
                const currentDelay = getDynamicDelay(totalTokens);
                timeoutId = setTimeout(processChunks, currentDelay);
            }
        },
        flush: async () => {
            // Clear any pending timeout to ensure immediate processing
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }

            // If there are chunks and not currently processing, process them immediately
            if (chunks.length > 0 && !isProcessing) {
                await processChunks();
            }

            // Wait until any ongoing processing completes
            while (isProcessing) {
                await new Promise((resolve) => setTimeout(resolve, initialDelay))
            }
        },
    }
}
