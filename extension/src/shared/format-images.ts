import Anthropic from "@anthropic-ai/sdk"

/**
 * Helper function to detect image type from base64 string
 */
function getBase64ImageType(base64String: string): string | null {
	// Handle data URL format
	if (base64String.includes("data:")) {
		const matches = base64String.match(/^data:([^;]+);base64,/)
		return matches ? matches[1] : null
	}

	// For stripped base64, check the first few characters
	// PNG files start with iVBOR... when base64 encoded
	if (base64String.startsWith("iVBOR")) {
		return "image/png"
	}

	// JPEG/JPG files start with /9j/4 when base64 encoded
	if (base64String.startsWith("/9j/4")) {
		return "image/jpeg"
	}

	// GIF files start with R0lGO when base64 encoded
	if (base64String.startsWith("R0lGO")) {
		return "image/gif"
	}

	// WebP files start with UklGR when base64 encoded
	if (base64String.startsWith("UklGR")) {
		return "image/webp"
	}

	// Default to JPEG if no match
	return "image/jpeg"
}

/**
 * Helper function to format base64 string
 */
function base64ToImageFormat(base64String: string, defaultType: string): string {
	// If it's already stripped, return as is
	if (!base64String.includes("data:")) {
		return base64String
	}

	// If it's a data URL, strip the prefix
	const parts = base64String.split(",")
	return parts[1] || parts[0]
}

/**
 * Main function to convert base64 string to image block
 */
export function base64StringToImageBlock(base64String: string): Anthropic.ImageBlockParam {
	const imageType = getBase64ImageType(base64String) as Anthropic.ImageBlockParam["source"]["media_type"]
	const imageFormat = base64ToImageFormat(base64String, imageType || "image/jpeg")

	return {
		type: "image",
		source: {
			type: "base64",
			media_type: imageType ?? "image/jpeg",
			data: imageFormat,
		},
	}
}
