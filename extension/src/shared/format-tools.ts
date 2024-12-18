import { ImageBlockParam, TextBlock, TextBlockParam } from "@anthropic-ai/sdk/resources/messages.mjs"
import type { ToolResponseV2 } from "../agent/v1/types"
import { base64StringToImageBlock } from "./format-images"
import dedent from "dedent"

export type ContentBlock = TextBlock | ImageBlockParam | TextBlockParam

export const isTextBlock = (block: any): block is TextBlock => {
	if (typeof block === "object") {
		return block.type === "text"
	}
	return false
}

export const isToolResponseV2 = (result: any): result is ToolResponseV2 => {
	return (
		typeof result === "object" &&
		result !== null &&
		"status" in result &&
		"toolName" in result &&
		"result" in result
	)
}

const rejectMsg = (msg: string) => `The Tool got rejected and returned the following message: ${msg}`
const errorMsg = (msg: string) => `The Tool encountered an error and returned the following message: ${msg}`
const feedbackMsg = (msg: string) => `The Tool returned the following feedback: ${msg}`
const successMsg = (msg: string) => `${msg}`

const toolFeedbackToMsg = (result: ToolResponseV2["status"]) => {
	switch (result) {
		case "rejected":
			return rejectMsg
		case "error":
			return errorMsg
		case "feedback":
			return feedbackMsg
		case "success":
			return successMsg
	}
}

export const toolResponseToAIState = (result: ToolResponseV2, isCompressed?: boolean): ContentBlock[] => {
	const blocks: ContentBlock[] = []
	if (typeof result.text === "string") {
		if (result.toolName === "spawn_agent") {
			return [
				{
					type: "text",
					text: result.text,
				},
			]
		}
		blocks.push({
			type: "text",
			text: dedent`<toolResponse>
            <toolName>${result.toolName}</toolName>
            <toolStatus>${result.status}</toolStatus>
            <toolResult>${toolFeedbackToMsg(result.status)(result.text)}</toolResult>
			${
				result.images?.length
					? `<images>there is ${result.images.length} image attached to the request, please check them.</images>\n`
					: ""
			}${
				isCompressed
					? `<isToolCompressed description="true if the tool output / input been compressed">true</isToolCompressed>\n`
					: ""
			}
            </toolResponse>
            `,
		})
	}
	if (result.images?.length) {
		blocks.push({
			type: "text",
			text: `Images attached to the request:`,
		})
		result.images.forEach((image) => {
			const imageBlock = base64StringToImageBlock(image)
			blocks.push(imageBlock)
		})
	}
	return blocks
}

export function getBase64ImageType(base64String: string): ImageBlockParam["source"]["media_type"] | null {
	// Remove data URL prefix if it exists
	const base64 = base64String.replace(/^data:image\/\w+;base64,/, "")

	// Take first few bytes of the base64 string
	const decoded = atob(base64).slice(0, 4)
	const bytes = new Uint8Array(decoded.length)

	for (let i = 0; i < decoded.length; i++) {
		bytes[i] = decoded.charCodeAt(i)
	}

	// Check magic numbers
	if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
		return "image/jpeg"
	}
	if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
		return "image/png"
	}
	if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
		return "image/gif"
	}
	if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
		return "image/webp"
	}

	return null
}

interface ToolResponse {
	toolName: string
	toolStatus: string
	toolResult: string
	hasImages?: boolean
}

/**
 * Parses XML string containing tool response into a structured object
 * @param xmlString The XML string to parse
 * @returns Parsed ToolResponse object
 * @throws Error if XML is invalid or required fields are missing
 */
export function parseToolResponse(xmlString: string): ToolResponse {
	try {
		// Helper function to extract content between XML tags, handling nested tags
		const getTagContent = (xml: string, tag: string): string => {
			const startTag = `<${tag}>`
			const endTag = `</${tag}>`

			const startIndex = xml.indexOf(startTag)
			if (startIndex === -1) {
				throw new Error(`Missing ${tag} in tool response`)
			}

			let endIndex = -1
			let depth = 1
			let searchStartIndex = startIndex + startTag.length

			while (depth > 0 && searchStartIndex < xml.length) {
				const nextStartTag = xml.indexOf(startTag, searchStartIndex)
				const nextEndTag = xml.indexOf(endTag, searchStartIndex)

				if (nextEndTag === -1) {
					throw new Error(`Malformed XML: Missing closing tag for ${tag}`)
				}

				if (nextStartTag !== -1 && nextStartTag < nextEndTag) {
					depth++
					searchStartIndex = nextStartTag + startTag.length
				} else {
					depth--
					if (depth === 0) {
						endIndex = nextEndTag
					}
					searchStartIndex = nextEndTag + endTag.length
				}
			}

			if (endIndex === -1) {
				throw new Error(`Malformed XML: Unable to find matching end tag for ${tag}`)
			}

			return xml.substring(startIndex + startTag.length, endIndex).trim()
		}

		// Extract values
		const toolResponseContent = getTagContent(xmlString, "toolResponse")
		const toolName = getTagContent(xmlString, "toolName")
		const toolStatus = getTagContent(xmlString, "toolStatus")
		const toolResult = getTagContent(xmlString, "toolResult")

		// Check for image text
		const hasImages = toolResponseContent.includes("check the images attached to the request")

		return {
			toolName,
			toolStatus,
			toolResult,
			hasImages,
		}
	} catch (error) {
		if (error instanceof Error) {
			throw new Error(`Failed to parse tool response: ${error.message}`)
		}
		throw new Error("Failed to parse tool response")
	}
}
