import { koduSSEResponse } from "../shared/kodu"

// Dynamic delay based on token count and chunk size
const getDynamicDelay = (tokenCount: number, chunkSize: number): number => {
    if (tokenCount > 50000) return Math.min(100, 25 + chunkSize / 1000);
    if (tokenCount > 10000) return Math.min(50, 15 + chunkSize / 500);
    return Math.min(25, 10 + chunkSize / 200);
};

// Dynamic batch size based on token count and processing time
const getDynamicBatchSize = (tokenCount: number, lastProcessingTime: number = 0): number => {
    const baseSize = tokenCount > 50000 ? 5000 : tokenCount > 10000 ? 1000 : 100;
    const timeAdjustment = lastProcessingTime > 100 ? 0.5 : lastProcessingTime > 50 ? 0.75 : 1;
    return Math.floor(baseSize * timeAdjustment);
};

export function createStreamDebouncer(
    callback: (chunks: koduSSEResponse[]) => Promise<void>, 
    initialDelay: number = 25,
    maxParallelBatches: number = 3
) {
    let timeoutId: NodeJS.Timeout | null = null;
    let chunks: koduSSEResponse[] = [];
    let isProcessing = false;
    let totalTokens = 0;
    let lastProcessingTime = 0;
    let activeProcessingCount = 0;

    const processBatch = async (batchChunks: koduSSEResponse[]): Promise<void> => {
        const startTime = Date.now();
        try {
            await callback(batchChunks);
        } catch (error) {
            console.error("Error processing chunks:", error);
            console.error("Problematic chunks:", JSON.stringify(batchChunks, null, 2));
        }
        lastProcessingTime = Date.now() - startTime;
        activeProcessingCount--;
    };

    const processChunks = async () => {
        isProcessing = true;

        while (chunks.length > 0 && activeProcessingCount < maxParallelBatches) {
            const currentDelay = getDynamicDelay(totalTokens, chunks.length);
            const batchSize = getDynamicBatchSize(totalTokens, lastProcessingTime);
            
            const chunksToProcess = chunks.splice(0, batchSize);
            activeProcessingCount++;
            
            // Process batch in parallel
            processBatch(chunksToProcess).catch(console.error);
            
            // Small delay between starting parallel batches to prevent overwhelming
            if (chunks.length > 0) {
                await new Promise(resolve => setTimeout(resolve, currentDelay));
            }
        }

        isProcessing = activeProcessingCount > 0;
        
        // Schedule next batch if there are remaining chunks
        if (chunks.length > 0) {
            timeoutId = setTimeout(processChunks, getDynamicDelay(totalTokens, chunks.length));
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
                const currentDelay = getDynamicDelay(totalTokens, chunks.length);
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
