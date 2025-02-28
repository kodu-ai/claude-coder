import { vscode } from "@/utils/vscode"
import { ClientForRouter, createAppClient, WebviewTransport } from "extension/shared/rpc-client"
import { useEvent } from "react-use"
import { useCallback } from "react"
import { Router } from "extension/router/utils/router"
import { createAppClientWithRQueryForApp } from "./create-app-client-with-rquery"

const transport = new WebviewTransport(vscode)
export const rpcClient = createAppClientWithRQueryForApp(transport)
/**
 * Create a typed client from a router *type only*
 * by using a Proxy under the hood. We do not need the actual router object.
 *
 * Usage:
 *   import type { AppRouter } from "../app-router";
 *   const client = createClientForRouter<AppRouter>(transport);
 *   const result = await client.renameTask.useQuery({ taskId: "abc", newName: "Hello" });
 *  const result = await client.renameTask.useMutation({ taskId: "abc", newName: "Hello" });
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

export const RPCClientProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	const handleMessage = useCallback((evt: MessageEvent) => {
		transport.handleMessage(evt.data)
		// (react-use takes care of not registering the same listener multiple times even if this callback is updated.)
	}, [])

	useEvent("message", handleMessage)
	return children
}
