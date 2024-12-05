import * as vscode from "vscode"
import * as path from "path"
import { getCwd } from "../utils"

export class DiagnosticsHandler {
	private static instance: DiagnosticsHandler

	private constructor() {
		// Private constructor to prevent direct instantiation
	}

	public static getInstance(): DiagnosticsHandler {
		if (!DiagnosticsHandler.instance) {
			DiagnosticsHandler.instance = new DiagnosticsHandler()
		}
		return DiagnosticsHandler.instance
	}

	public getDiagnostics(paths: string[]): { key: string; errorString: string | null }[] {
		const results: { key: string; errorString: string | null }[] = []

		for (const filePath of paths) {
			const uri = vscode.Uri.file(path.resolve(getCwd(), filePath))
			const diagnostics = vscode.languages.getDiagnostics(uri)
			const errors = diagnostics.filter((diag) => diag.severity === vscode.DiagnosticSeverity.Error)

			let errorString: string | null = null

			if (errors.length > 0) {
				errorString = this.formatDiagnostics(uri, errors)
			}

			results.push({ key: filePath, errorString })
		}

		return results
	}

	private formatDiagnostics(uri: vscode.Uri, diagnostics: vscode.Diagnostic[]): string {
		const relativePath = vscode.workspace.asRelativePath(uri.fsPath).replace(/\\/g, "/")

		// Start building XML structure
		let result = "<diagnostics>\n"
		result += `  <file path="${relativePath}">\n`

		// Get the document to access its content
		const document = vscode.workspace.textDocuments.find((doc) => doc.uri.fsPath === uri.fsPath)

		for (const diagnostic of diagnostics) {
			const line = diagnostic.range.start.line + 1 // VSCode lines are 0-indexed
			const startChar = diagnostic.range.start.character
			const endChar = diagnostic.range.end.character
			const message = diagnostic.message

			// Get the line content if document is available
			let lineContent = "Unable to retrieve line content"
			let errorPointer = ""

			// if (document) {
			// 	lineContent = document.lineAt(diagnostic.range.start.line).text
			// 	// Create a pointer to show exactly where the error is
			// 	errorPointer = " ".repeat(startChar) + "^".repeat(Math.max(1, endChar - startChar))
			// }

			// Add error information in XML format
			result += "    <error>\n"
			result += `      <line>${line}</line>\n`
			result += `      <message>${message}</message>\n`
			// result += `      <code>${lineContent}</code>\n`
			// result += `      <pointer>${errorPointer}</pointer>\n`
			result += `      <position start="${startChar}" end="${endChar}" />\n`
			result += "    </error>\n"
		}

		result += "  </file>\n"
		result += "</diagnostics>"

		return result
	}

	private escapeXml(unsafe: string): string {
		return unsafe.replace(/[<>&'"]/g, (c) => {
			switch (c) {
				case "<":
					return "&lt;"
				case ">":
					return "&gt;"
				case "&":
					return "&amp;"
				case "'":
					return "&apos;"
				case '"':
					return "&quot;"
				default:
					return c
			}
		})
	}
}
