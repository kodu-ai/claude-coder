import fs from "fs/promises"
import * as path from "path"
import { IConsumer } from "@/interfaces"

export async function selectImages(consumer: IConsumer): Promise<string[]> {
	const fileUris = await consumer.filesAdapter.selectImages()

	return await Promise.all(
		fileUris.map(async (imagePath) => {
			const buffer = await fs.readFile(imagePath)
			const base64 = buffer.toString("base64")
			const mimeType = getMimeType(imagePath)
			const dataUrl = `data:${mimeType};base64,${base64}`
			return dataUrl
		})
	)
}

function getMimeType(filePath: string): string {
	const ext = path.extname(filePath).toLowerCase()
	switch (ext) {
		case ".png":
			return "image/png"
		case ".jpeg":
		case ".jpg":
			return "image/jpeg"
		case ".webp":
			return "image/webp"
		default:
			throw new Error(`Unsupported file type: ${ext}`)
	}
}

export async function compressImages(images: string[]) {
	// TODO: Implement image compression
	return images
}
