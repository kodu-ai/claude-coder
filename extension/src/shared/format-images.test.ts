import { base64StringToImageBlock } from "./format-images"

describe("base64StringToImageBlock", () => {
	// Test data
	const pngDataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAA..."
	const jpegDataUrl = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQE..."
	const strippedPngBase64 = "iVBORw0KGgoAAAANSUhEUgAAA..."
	const strippedJpegBase64 = "/9j/4AAQSkZJRgABAQE..."
	const gifDataUrl = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
	const webpDataUrl = "data:image/webp;base64,UklGRl4AAABXRUJQVlA4..."

	test("handles PNG data URL correctly", () => {
		const result = base64StringToImageBlock(pngDataUrl)
		expect(result).toEqual({
			type: "image",
			source: {
				type: "base64",
				media_type: "image/png",
				data: "iVBORw0KGgoAAAANSUhEUgAAA...",
			},
		})
	})

	test("handles JPEG data URL correctly", () => {
		const result = base64StringToImageBlock(jpegDataUrl)
		expect(result).toEqual({
			type: "image",
			source: {
				type: "base64",
				media_type: "image/jpeg",
				data: "/9j/4AAQSkZJRgABAQE...",
			},
		})
	})

	test("handles stripped PNG base64 correctly", () => {
		const result = base64StringToImageBlock(strippedPngBase64)
		expect(result).toEqual({
			type: "image",
			source: {
				type: "base64",
				media_type: "image/png",
				data: strippedPngBase64,
			},
		})
	})

	test("handles stripped JPEG base64 correctly", () => {
		const result = base64StringToImageBlock(strippedJpegBase64)
		expect(result).toEqual({
			type: "image",
			source: {
				type: "base64",
				media_type: "image/jpeg",
				data: strippedJpegBase64,
			},
		})
	})

	test("handles GIF data URL correctly", () => {
		const result = base64StringToImageBlock(gifDataUrl)
		expect(result).toEqual({
			type: "image",
			source: {
				type: "base64",
				media_type: "image/gif",
				data: "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
			},
		})
	})

	test("handles WebP data URL correctly", () => {
		const result = base64StringToImageBlock(webpDataUrl)
		expect(result).toEqual({
			type: "image",
			source: {
				type: "base64",
				media_type: "image/webp",
				data: "UklGRl4AAABXRUJQVlA4...",
			},
		})
	})

	test("handles invalid base64 with default JPEG type", () => {
		const invalidBase64 = "invalid-base64-string"
		const result = base64StringToImageBlock(invalidBase64)
		expect(result).toEqual({
			type: "image",
			source: {
				type: "base64",
				media_type: "image/jpeg",
				data: invalidBase64,
			},
		})
	})

	test("handles empty string with default JPEG type", () => {
		const result = base64StringToImageBlock("")
		expect(result).toEqual({
			type: "image",
			source: {
				type: "base64",
				media_type: "image/jpeg",
				data: "",
			},
		})
	})

	test("preserves base64 data when format is unknown", () => {
		const unknownFormat = "data:image/unknown;base64,SGVsbG8gV29ybGQ="
		const result = base64StringToImageBlock(unknownFormat)
		expect(result).toEqual({
			type: "image",
			source: {
				type: "base64",
				media_type: "image/unknown",
				data: "SGVsbG8gV29ybGQ=",
			},
		})
	})
})
