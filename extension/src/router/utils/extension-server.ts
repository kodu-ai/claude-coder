// extension-server.ts

import * as vscode from "vscode"
import { z } from "zod"
import { ExtensionContext } from "./context"
import { appRouter } from "../app-router"

/**
 * The shape of a message from the webview calling a procedure:
 *   - id: A unique ID for correlating requests/responses (like TRPC's requestId).
 *   - route: Name of the procedure in `appRouter` (e.g. 'renameTask')
 *   - input: The data to pass to that procedure
 */
const requestMessageSchema = z.object({
	id: z.string(),
	route: z.string(),
	input: z.unknown(), // We'll parse again with the route's own schema
	type: z.literal("rpcRequest"),
})

export class ExtensionServer {
	private pending: Map<string, (data: any) => void> = new Map()

	constructor(private vscodeWebview: vscode.Webview, private ctx: ExtensionContext) {
		// Listen for messages from the webview
		this.vscodeWebview.onDidReceiveMessage((msg) => this.handleMessage(msg))
	}

	/**
	 * Handling incoming messages from the webview:
	 *
	 * 1) parse with requestMessageSchema
	 * 2) find the matching route in appRouter
	 * 3) parse input with route.schema
	 * 4) call route.use(...) with (ctx, input)
	 * 5) respond with the correlation `id` plus `result` or `error`
	 */
	private async handleMessage(msg: unknown) {
		// parse base shape
		let parsed: z.infer<typeof requestMessageSchema>
		const isRpcRequest = typeof msg === "object" && "type" in msg! && msg["type"] === "rpcRequest"
		if (!isRpcRequest) {
			// we only handle rpcRequest messages
			return
		}
		try {
			parsed = requestMessageSchema.parse(msg)
		} catch (err) {
			console.error("Malformed request from webview:", err)
			return
		}

		const { id, route, input } = parsed
		const procedure = (appRouter as any)[route]
		if (!procedure) {
			console.error(`No route named '${route}' in the router.`)
			this.sendResponse(id, null, `Route '${route}' not found.`)
			return
		}

		// If the route has a .schema, parse the input
		try {
			if (procedure.schema) {
				procedure.schema.parse(input) // Validate input
			}
		} catch (err) {
			this.sendResponse(id, null, `Invalid input: ${err}`)
			return
		}

		try {
			const result = await procedure.use(this.ctx, input)
			// 5) respond
			this.sendResponse(id, result, null)
		} catch (err: any) {
			this.sendResponse(id, null, err?.message ?? String(err))
		}
	}

	/**
	 * Send a response back to the webview with correlation ID.
	 */
	private sendResponse(id: string, result: any, error: string | null) {
		this.vscodeWebview.postMessage({
			type: "rpcResponse",
			id,
			result,
			error,
		})
	}
}
