import { z } from "zod"
import { getCwd } from "../utils"

export const writeToFileSchema = z
	.object({
		path: z
			.string()
			.describe(`The path of the file to write to (relative to the current working directory ${getCwd()}).`),
		content: z.string().describe("The full content to write to the file."),
	})
	.describe(
		"Write content to a file at the specified path. If the file exists, it will be overwritten with the provided content. If the file doesn't exist, it will be created. Always provide the full intended content of the file, without any truncation. This tool will automatically create any directories needed to write the file."
	)

const writeToFileArtifact = async (input: z.infer<typeof writeToFileSchema>) => {
	//
}
