import FileList, { FileItem } from "@/components/ChatRow/FileList"

export function extractAdditionalContext(input: string): [string, string | null] {
	const regex = /<additional-context(?:\s+[^>]*)?>[\s\S]*?<\/additional-context>/
	const match = input.match(regex)

	if (match) {
		const [fullMatch] = match
		const index = input.indexOf(fullMatch)
		const before = input.slice(0, index)
		const after = input.slice(index + fullMatch.length)
		return [before + after, fullMatch]
	}

	return [input, null]
}

export function extractFilesFromContext(input: string): FileItem[] {
	const fileRegex = /<file\s+path="([^"]+)">(.*?)<\/file>/gs
	const files: FileItem[] = []
	let match

	while ((match = fileRegex.exec(input)) !== null) {
		const path = match[1] // Extract the path from the first capturing group
		const content = match[2].trim() // Extract and trim the content from the second capturing group
		const name = path.split("/").pop() || "" // Get the file name from the path

		files.push({ name, content }) // Create a FileItem object and push it to the array
	}

	return files // Return the array of FileItem objects
}

export const TextWithAttachments = ({ text }: { text?: string }) => {
	if (!text) {
		return null
	}
	const [mainContent, additionalContent] = extractAdditionalContext(text)
	const files = extractFilesFromContext(additionalContent || "")

	return (
		<div>
			{mainContent}
			{files.length > 0 && <FileList files={files} />}
		</div>
	)
}
