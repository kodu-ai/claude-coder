import * as path from "path"
import * as vscode from "vscode"

import deepEqual from "fast-deep-equal"
import { VsCodeDiagnostics } from ".."

export class DiagnosticsHandler {
	private seenErrors: VsCodeDiagnostics = []

	constructor() {
		this.seenErrors = this.currentErrors
	}

	getProblemsString(cwd: string): string {
		return DiagnosticsHandler.diagnosticsToString(
			this.currentErrors,
			[vscode.DiagnosticSeverity.Error, vscode.DiagnosticSeverity.Warning],
			cwd
		)
	}

	get currentErrors(): VsCodeDiagnostics {
		return vscode.languages
			.getDiagnostics()
			.map(([uri, d]) => [uri, d.filter((d) => d.severity === vscode.DiagnosticSeverity.Error)])
	}

	getErrorsGeneratedByLastStep(): VsCodeDiagnostics {
		const newErrors: [vscode.Uri, vscode.Diagnostic[]][] = []
		const seenMap = new Map(this.seenErrors)

		for (const [uri, newDiags] of this.currentErrors) {
			const seenErrorsForUri = seenMap.get(uri) || []
			const newErrorsForUri = newDiags.filter(
				(newError) => !seenErrorsForUri.some((seenError) => deepEqual(seenError, newError))
			)

			if (newErrorsForUri.length > 0) {
				newErrors.push([uri, newErrorsForUri])
			}
		}

		return newErrors
	}

	updateSeenErrors() {
		this.seenErrors = this.currentErrors
	}

	static errorsToString(errors: VsCodeDiagnostics, cwd: string): string {
		return DiagnosticsHandler.diagnosticsToString(errors, [vscode.DiagnosticSeverity.Error], cwd)
	}

	/**
	 * MIT Saoud Rizwan:
	 * https://github.com/saoudrizwan/claude-dev/blob/361edd47fac2c1841b53696948685db9f16603dd/src/integrations/diagnostics/index.ts#L73
	 */
	static diagnosticsToString(
		diagnostics: VsCodeDiagnostics,
		severities: vscode.DiagnosticSeverity[],
		cwd: string
	): string {
		if (diagnostics.length === 0) {
			return ""
		}

		let result = ""
		for (const [uri, fileDiagnostics] of diagnostics) {
			const problems = fileDiagnostics.filter((d) => severities.includes(d.severity))

			if (problems.length > 0) {
				result += `\n\n${path.relative(cwd, uri.fsPath).toPosix()}`
				for (const diagnostic of problems) {
					let label = ""
					switch (diagnostic.severity) {
						case vscode.DiagnosticSeverity.Error:
							label = "Error"
							break
						case vscode.DiagnosticSeverity.Warning:
							label = "Warning"
							break
					}

					if (!label) {
						continue
					}

					const line = diagnostic.range.start.line + 1 // VSCode lines are 0-indexed
					const source = diagnostic.source ? `${diagnostic.source} ` : ""
					result += `\n- [${source}${label}] Line ${line}: ${diagnostic.message}`
				}
			}
		}

		if (!result) {
			return ""
		}

		return "\n New problems detected:\n" + result.trim()
	}
}
