// create-app-client-with-rquery.ts
import {
	useQuery,
	useMutation,
	UseQueryOptions,
	UseQueryResult,
	UseMutationOptions,
	UseMutationResult,
	MutationOptions,
	QueryOptions,
} from "@tanstack/react-query"

import type { AppRouter } from "extension/router/app-router"
import { ProcedureInstance } from "extension/router/utils/procedure"
import { Router } from "extension/router/utils/router"
import { WebviewTransport } from "extension/shared/rpc-client"

/**
 * For each route key in TRouter, produce an object that contains:
 *   - useQuery: a hook for fetching data (with typed input/output)
 *   - useMutation: a hook for mutating data (with typed input/output)
 */
type ReactQueryClientForRouter<TRouter extends Router> = {
	[K in keyof TRouter]: TRouter[K] extends ProcedureInstance<any, infer TInput, infer TOutput>
		? {
				useQuery: (
					input: TInput,
					options?: Omit<UseQueryOptions<TOutput, unknown, TOutput, [K, TInput]>, "queryKey" | "queryFn">
				) => UseQueryResult<TOutput, unknown>

				useMutation: (
					options?: Omit<UseMutationOptions<TOutput, unknown, TInput, unknown>, "mutationFn">
				) => UseMutationResult<TOutput, unknown, TInput, unknown>
		  }
		: never
}

/**
 * Creates a typed client that exposes `useQuery` and `useMutation`
 * hooks for each route in the given router.
 *
 * Usage:
 *   import { createAppClientWithRQuery } from "./create-app-client-with-rquery";
 *   const appClient = createAppClientWithRQuery(transport);
 *
 *   function MyComponent() {
 *     // example: "renameTask" from your AppRouter
 *     const { data, isLoading } = appClient.renameTask.useQuery({ taskId: "abc", newName: "Hello" });
 *     const mutation = appClient.renameTask.useMutation({
 *       onSuccess: (result) => { ... }
 *     });
 *
 *     // ...
 *   }
 */
export function createAppClientWithRQuery<TRouter extends Router>(
	transport: WebviewTransport
): ReactQueryClientForRouter<TRouter> {
	return new Proxy({} as ReactQueryClientForRouter<TRouter>, {
		get(_target, routeKey: string) {
			// Because we’re inside a Proxy, `propKey` is a string,
			// but we’ll treat it as the route name (K).
			return {
				/**
				 * Typed useQuery for this route.
				 */
				useQuery: (input: unknown, options: QueryOptions) => {
					return useQuery({
						// This array uniquely identifies the query
						queryKey: [routeKey, input] as const,
						// Function to actually call our RPC endpoint
						queryFn: () => transport.call(routeKey, input),
						// Spread in any user-supplied options (e.g. staleTime, enabled, etc.)
						...options,
					})
				},

				/**
				 * Typed useMutation for this route.
				 */
				useMutation: (options: MutationOptions) => {
					return useMutation({
						// Provide the mutationFn here
						mutationFn: (input: unknown) => transport.call(routeKey, input),
						// Spread in any user-supplied options (e.g. onSuccess, onError, etc.)
						...options,
					})
				},
			}
		},
	})
}

/**
 * Convenience function specifically for your AppRouter.
 */
export function createAppClientWithRQueryForApp(transport: WebviewTransport) {
	return createAppClientWithRQuery<AppRouter>(transport)
}
