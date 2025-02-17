import { Resource } from "../../../shared/messages/client-message";
/**
 * Reads all files and folders mentioned in argument
 * @param resources - Array of either file, folder or url, each represented as a string
 * @returns Array of Anthropic.Message
 */
export declare function formatAttachementsIntoBlocks(resources?: Resource[]): Promise<string>;
