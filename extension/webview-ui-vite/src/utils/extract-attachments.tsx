import AttachmentsList, { FileItem, UrlItem } from "@/components/chat-row/file-list"
import MarkdownRenderer from "@/components/chat-row/markdown-renderer"
import { getSyntaxHighlighterStyleFromTheme } from "./get-syntax-highlighter-style-from-theme"
import { syntaxHighlighterCustomStyle } from "@/components/code-block/utils"

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

export function extractUrlsFromContext(input: string): UrlItem[] {
	const urlRegex = /<url\s+link="([^"]+)"\s+description="([^"]+)"\s*\/>/gs
	const urls: UrlItem[] = []
	let match

	// Extract individual URLs
	while ((match = urlRegex.exec(input)) !== null) {
		const url = match[1] // Extract the link from the first capturing group
		const description = match[2].trim() // Extract and trim the description from the second capturing group

		urls.push({ url, description }) // Create a UrlItem object and push it to the array
	}

	// Extract grouped URLs
	const groupedUrlRegex = /<urls\s+count="\d+">([\s\S]*?)<\/urls>/g
	while ((match = groupedUrlRegex.exec(input)) !== null) {
		const urlsContent = match[1].trim() // Extract the content between <urls> tags

		// Split the content into individual URLs (assuming they are separated by newlines)
		const additionalUrls = urlsContent
			.split("\n")
			.map((url) => url.trim())
			.filter(Boolean)

		// Add each URL to the UrlItem list with a default description if needed
		additionalUrls.forEach((url) => {
			urls.push({ url, description: "No description provided" })
		})
	}

	return urls // Return the array of UrlItem objects
}

export const TextWithAttachments = ({ text }: { text?: string }) => {
	if (!text) {
		return null
	}
	const [mainContent, additionalContent] = extractAdditionalContext(text)
	const files = extractFilesFromContext(additionalContent || "")
	const urls = extractUrlsFromContext(additionalContent || "")

	return (
		<div className="flex w-full max-w-[100vw]">
			<span className="w-full max-w-md break-words">{mainContent}</span>
			<AttachmentsList files={files} urls={urls} />
		</div>
	)
}
