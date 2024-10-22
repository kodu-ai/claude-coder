import fs from 'node:fs/promises'
import * as path from 'node:path'
import * as vscode from 'vscode'

export async function selectImages(): Promise<string[]> {
	const options: vscode.OpenDialogOptions = {
		canSelectMany: true,
		openLabel: 'Select',
		filters: {
			Images: ['png', 'jpg', 'jpeg', 'webp'], // supported by anthropic and openrouter
		},
	}

	const fileUris = await vscode.window.showOpenDialog(options)

	if (!fileUris || fileUris.length === 0) {
		return []
	}

	return await Promise.all(
		fileUris.map(async (uri) => {
			const imagePath = uri.fsPath
			const buffer = await fs.readFile(imagePath)
			const base64 = buffer.toString('base64')
			const mimeType = getMimeType(imagePath)
			const dataUrl = `data:${mimeType};base64,${base64}`
			return dataUrl
		}),
	)
}

function getMimeType(filePath: string): string {
	const ext = path.extname(filePath).toLowerCase()
	switch (ext) {
		case '.png':
			return 'image/png'
		case '.jpeg':
		case '.jpg':
			return 'image/jpeg'
		case '.webp':
			return 'image/webp'
		default:
			throw new Error(`Unsupported file type: ${ext}`)
	}
}

export async function compressImages(images: string[]) {
	// TODO: Implement image compression
	return images
}
