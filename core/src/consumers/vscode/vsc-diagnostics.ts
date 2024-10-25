import * as vscode from "vscode"
import * as path from "path"
import { getCwd } from "@/utils"
import { IDiagnosticsHandler } from "@/interfaces"

export class VscDiagnosticsHandler implements IDiagnosticsHandler {
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
		let result = `Errors in ${relativePath}:\n`

		for (const diagnostic of diagnostics) {
			const line = diagnostic.range.start.line + 1 // VSCode lines are 0-indexed
			const message = diagnostic.message
			result += `- Line ${line}: ${message}\n`
		}

		return result.trim()
	}
}
