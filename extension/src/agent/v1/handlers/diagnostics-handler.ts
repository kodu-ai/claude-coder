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

	public async getDiagnostics(paths: string[]): Promise<{ key: string; errorString: string | null }[]> {
		const results: { key: string; errorString: string | null }[] = []

		for (const filePath of paths) {
			const uri = vscode.Uri.file(path.resolve(getCwd(), filePath))
			const diagnostics = vscode.languages.getDiagnostics(uri)
			const errors = diagnostics.filter((diag) => diag.severity === vscode.DiagnosticSeverity.Error)

			let errorString: string | null = null
			if (errors.length > 0) {
				errorString = await this.formatDiagnostics(uri, errors)
			}

			results.push({ key: filePath, errorString })
		}

		return results
	}

	private async formatDiagnostics(uri: vscode.Uri, diagnostics: vscode.Diagnostic[]): Promise<string> {
		const relativePath = vscode.workspace.asRelativePath(uri.fsPath).replace(/\\/g, "/")
		const lines: string[] = []

		lines.push(`File: ${relativePath}`)

		for (const diagnostic of diagnostics) {
			const line = diagnostic.range.start.line + 1 // VSCode is 0-based
			const message = diagnostic.message.trim()

			// Retrieve code actions (potential hints)
			const codeActions = await vscode.commands.executeCommand<vscode.CodeAction[]>(
				"vscode.executeCodeActionProvider",
				uri,
				diagnostic.range
			)

			lines.push(`  Line ${line}: ${message}`)

			if (codeActions && codeActions.length > 0) {
				for (const action of codeActions) {
					lines.push(`    Hint: ${action.title.trim()}`)
				}
			}
		}

		return lines.join("\n")
	}
}
