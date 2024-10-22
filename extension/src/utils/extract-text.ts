import fs from 'node:fs/promises'
import * as path from 'node:path'
import mammoth from 'mammoth'
// @ts-ignore-next-line
import pdf from 'pdf-parse/lib/pdf-parse'

export async function extractTextFromFile(filePath: string): Promise<string> {
	try {
		await fs.access(filePath)
	} catch (error) {
		throw new Error(`File not found: ${filePath}`)
	}
	const fileExtension = path.extname(filePath).toLowerCase()
	switch (fileExtension) {
		case '.pdf':
			return extractTextFromPDF(filePath)
		case '.docx':
			return extractTextFromDOCX(filePath)
		case '.ipynb':
			return extractTextFromIPYNB(filePath)
		default:
			return await fs.readFile(filePath, 'utf8')
	}
}

async function extractTextFromPDF(filePath: string): Promise<string> {
	const dataBuffer = await fs.readFile(filePath)
	const data = await pdf(dataBuffer)
	return data.text
}

async function extractTextFromDOCX(filePath: string): Promise<string> {
	const result = await mammoth.extractRawText({ path: filePath })
	return result.value
}

async function extractTextFromIPYNB(filePath: string): Promise<string> {
	const data = await fs.readFile(filePath, 'utf8')
	const notebook = JSON.parse(data)
	let extractedText = ''

	for (const cell of notebook.cells) {
		if ((cell.cell_type === 'markdown' || cell.cell_type === 'code') && cell.source) {
			extractedText += `${cell.source.join('\n')}\n`
		}
	}

	return extractedText
}
