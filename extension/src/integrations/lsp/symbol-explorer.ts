import * as vscode from "vscode"

interface FunctionIntelliSenseInfo {
	name: string
	kind: string
	hoverPreview: string
}

export class SymbolExplorer {
	private fileUri: vscode.Uri

	constructor(filePath: string) {
		this.fileUri = vscode.Uri.file(filePath)
	}

	/**
	 * Lists the top-level functions and returns concise IntelliSense info for each.
	 * We consider only top-level symbols of kind Function (and optionally Method, if desired).
	 * Returns XML as a string.
	 */
	public async listTopLevelFunctionIntelliSense(): Promise<string> {
		const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
			"vscode.executeDocumentSymbolProvider",
			this.fileUri
		)

		if (!symbols || symbols.length === 0) {
			// No symbols at all
			return `<functions/>`
		}

		// Filter to top-level functions only
		const functionLikeKinds = new Set([vscode.SymbolKind.Function])
		// or the first child of a class and the first child of the class is a function
		const functionSymbols = symbols.filter(
			(sym) =>
				functionLikeKinds.has(sym.kind) ||
				(sym.children && sym.children.length > 0 && functionLikeKinds.has(sym.children[0].kind)) ||
				(sym.children &&
					sym.children.length > 0 &&
					sym.children[0].children &&
					sym.children[0].children.length > 0 &&
					functionLikeKinds.has(sym.children[0].children[0].kind))
		)

		if (functionSymbols.length === 0) {
			// No top-level functions found
			return `<functions/>`
		}

		const functionInfos: FunctionIntelliSenseInfo[] = []
		for (const funcSym of functionSymbols) {
			const hoverPreview = await this.getHoverPreview(funcSym)
			functionInfos.push({
				name: funcSym.name,
				kind: vscode.SymbolKind[funcSym.kind],
				hoverPreview,
			})
		}

		// Format the function info into XML
		const xmlFunctions = functionInfos
			.map((func) => {
				// Escape XML special chars in hoverPreview
				const safeHover = func.hoverPreview.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

				return `  <function>
    <name>${func.name}</name>
    <kind>${func.kind}</kind>
    <hover>${safeHover}</hover>
  </function>`
			})
			.join("\n")

		return `<functions>\n${xmlFunctions}\n</functions>`
	}

	/**
	 * Retrieve a concise hover preview for a given symbol.
	 * For simplicity, we take the first line of the first hover result if available.
	 */
	private async getHoverPreview(symbol: vscode.DocumentSymbol): Promise<string> {
		const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
			"vscode.executeHoverProvider",
			this.fileUri,
			symbol.range.start
		)

		if (!hovers || hovers.length === 0) {
			return "No IntelliSense info available"
		}

		const firstHover = hovers[0]
		if (firstHover.contents && firstHover.contents.length > 0) {
			const firstContent = firstHover.contents[0]
			let text: string | undefined

			if (typeof firstContent === "string") {
				text = firstContent
			} else if ("value" in firstContent && typeof firstContent.value === "string") {
				text = firstContent.value
			}

			if (text) {
				const firstLine = text.split("\n")[0].trim()
				return firstLine.length > 0 ? firstLine : "No IntelliSense info available"
			}
		}

		return "No IntelliSense info available"
	}
}
