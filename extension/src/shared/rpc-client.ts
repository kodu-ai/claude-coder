// webview-transport.ts
import { object, z } from "zod"
import { ProcedureInstance } from "../router/utils/procedure"
import { Router } from "../router/utils/router"
import { AppRouter } from "../router/app-router"

const responseSchema = z.object({
	type: z.literal("rpcResponse"),
	id: z.string(),
	result: z.unknown().optional(),
	error: z.string().nullable().optional(),
})

/**
 * Basic transport: correlation-based request→response.
 */
export class WebviewTransport {
	private pending = new Map<string, { resolve: (val: any) => void; reject: (err: Error) => void }>()

	constructor(private vscodeApi: { postMessage(msg: any): void }) {}

	/**
	 * Send an RPC request.
	 * @param route The procedure name (e.g. 'renameTask')
	 * @param input The data for that route
	 */
	call<T = any>(route: string, input: unknown): Promise<T> {
		const id = crypto.randomUUID()
		return new Promise((resolve, reject) => {
			this.pending.set(id, { resolve, reject })
			this.vscodeApi.postMessage({ id, route, input, type: "rpcRequest" })
		})
	}

	/**
	 * The webview must pass incoming messages here, e.g.:
	 *   window.addEventListener('message', e => transport.handleMessage(e.data));
	 */
	handleMessage(msg: unknown) {
		const isRpcResponse = typeof msg === "object" && "type" in msg! && msg["type"] === "rpcResponse"
		if (!isRpcResponse) {
			// we only handle rpcResponse messages
			return
		}
		const parsed = responseSchema.safeParse(msg)
		if (!parsed.success) {
			return
		}

		const { id, result, error } = parsed.data
		const pendingReq = this.pending.get(id)
		if (!pendingReq) {
			return
		}
		this.pending.delete(id)

		if (error) {
			pendingReq.reject(new Error(error))
		} else {
			pendingReq.resolve(result)
		}
	}
}

/**
 * For each route key in TRouter, produce a function:
 *   (input: TInput) => Promise<TOutput>
 */
export type ClientForRouter<TRouter extends Router> = {
	[K in keyof TRouter]: TRouter[K] extends ProcedureInstance<any, infer TInput, infer TOutput>
		? (input: TInput) => Promise<TOutput>
		: never
}

/**
 * Create a typed client from a router *type only*
 * by using a Proxy under the hood. We do not need the actual router object.
 *
 * Usage:
 *   import type { AppRouter } from "../app-router";
 *   const client = createClientForRouter<AppRouter>(transport);
 *   const result = await client.renameTask({ taskId: "abc", newName: "Hello" });
 */
export function createClientForRouter<TRouter extends Router>(transport: WebviewTransport): ClientForRouter<TRouter> {
	// We'll intercept property access, e.g. client.renameTask.
	// Then we do transport.call("renameTask", input).
	return new Proxy(
		{},
		{
			get(_target, propKey: string) {
				// Return a function that calls the route
				return (input: unknown) => {
					return transport.call(propKey, input)
				}
			},
		}
	) as ClientForRouter<TRouter>
}

export const createAppClient = (transport: WebviewTransport) => createClientForRouter<AppRouter>(transport)
