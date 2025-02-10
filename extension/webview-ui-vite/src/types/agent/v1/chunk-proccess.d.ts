import { koduSSEResponse } from "../../shared/kodu";
type ChunkCallback = (chunk: koduSSEResponse) => Promise<void>;
interface ChunkProcessorCallbacks {
    onImmediateEndOfStream: ChunkCallback;
    onChunk: ChunkCallback;
    onFinalEndOfStream: ChunkCallback;
    /**
     * Optional callback invoked before the first chunk is read.
     */
    onStreamStart?: () => Promise<void>;
}
export declare class ChunkProcessor {
    private callbacks;
    private chunkQueue;
    private isProcessing;
    private endOfStreamReceived;
    private isFirstChunkReceived;
    constructor(callbacks: ChunkProcessorCallbacks);
    processStream(stream: AsyncGenerator<koduSSEResponse, any, unknown>): Promise<void>;
    private processNextChunk;
}
export {};
