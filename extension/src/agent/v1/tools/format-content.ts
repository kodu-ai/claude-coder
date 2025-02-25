import * as path from "path"
import * as vscode from "vscode"
import { Resource } from "../../../shared/messages/client-message"
import * as fs from "fs/promises"
import { getCwd } from "../utils"
export async function readFile(relPath: string): Promise<string> {
	// check if this is already absolute path
	if (path.isAbsolute(relPath)) {
		const fileContent = await fs.readFile(relPath)
		return Buffer.from(fileContent).toString("utf8")
	}
	const filePath = path.join(getCwd(), relPath)
	const absolutePath = path.resolve(filePath)
	const fileContent = await fs.readFile(absolutePath)
	return Buffer.from(fileContent).toString("utf8")
}

/**
 * Reads all files and folders mentioned in argument
 * @param resources - Array of either file, folder or url, each represented as a string
 * @returns Array of Anthropic.Message
 */
export async function formatAttachementsIntoBlocks(resources?: Resource[]): Promise<string> {
	if (!resources || resources.length === 0) {
		return ""
	}

	const additionalContextFiles: string[] = []
	const additionalScrappedUrls: string[] = []
	for (const resource of resources || []) {
		if (resource.type === "file") {
			// Prepend `./` to the file path
			const fileContent = await readFile(resource.id)
			additionalContextFiles.push(`<file path="${resource.id}">${fileContent}</file>`)
		} else if (resource.type === "url") {
			additionalScrappedUrls.push(`<url link="${resource.name}" description="${resource.description}"/>`)
		}
	}
	const additionalFilesContext = `<files count="${additionalContextFiles.length}">${additionalContextFiles.join(
		"\n"
	)}</files>`
	const additionalScrappedUrlsContext = `<urls>${additionalScrappedUrls.join("\n")}</urls>`

	return `
	<additional-context>
	- Super critical information, the files attached here are part of the task and need to be taken into consideration, you don't need to read the content of the file, it is already inside of the tags
	${
		additionalScrappedUrls &&
		"- The URLs attached here need to be scrapped and the information should be used for the task, refer to the description for which information to get"
	}
	${
		additionalFilesContext &&
		"- The files passed in context are provided to help you understand the task better, the original file does not need to be read, it is included in the content of the file"
	}
	${additionalFilesContext}
	${additionalScrappedUrlsContext}
	</additional-context>
	`
}
