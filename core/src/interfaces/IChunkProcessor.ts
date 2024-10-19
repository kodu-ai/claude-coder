export interface IChunkProcessor {
  processChunk(chunk: string): Promise<void>;
  // Add any other methods related to chunk processing
}