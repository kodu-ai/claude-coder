import { z, ZodType } from "zod";
/**
 * The chainable builder for a single procedure, similar to TRPC.
 *
 * - `input(schema)`: sets a Zod schema for the procedure's input.
 * - `resolve(fn)`: finalizes the procedure with a resolver function.
 */
export interface ProcedureBuilder<TContext, TInput extends ZodType<any> | null, TOutput> {
    /**
     * Define the Zod schema for this procedure's input.
     */
    input<TNewInput extends ZodType<any>>(schema: TNewInput): ProcedureBuilder<TContext, TNewInput, TOutput>;
    /**
     * Finalize this procedure by providing a resolver function.
     * The resolver receives a typed `ctx` and typed `input`.
     *
     * Once resolved, it returns a finalized ProcedureInstance
     * which has the ability to be invoked (on the server)
     * or used in a direct `.use(...)` call if you want direct usage.
     */
    resolve<TNewOutput>(fn: (ctx: TContext, input: TInput extends ZodType<any> ? z.infer<TInput> : never) => Promise<TNewOutput> | TNewOutput): ProcedureInstance<TContext, TInput extends ZodType<any> ? z.infer<TInput> : never, TNewOutput>;
}
/**
 * The final shape after calling `.resolve(...)`.
 * This "ProcedureInstance" can:
 *   - Provide a `.use(...)` method if you want direct invocation in Node
 *   - Expose `.schema` for the Zod input schema
 *   - Store the resolver function for server invocation
 */
export interface ProcedureInstance<TContext, TParsedInput, TOutput> {
    /**
     * The Zod schema for this procedure's input (or undefined if none).
     */
    schema?: ZodType<TParsedInput>;
    /**
     * Call this procedure directly in Node (outside of VS Code message flow).
     * Example usage: `myProcedure.use(myContext, { foo: "bar" })`.
     */
    use: (ctx: TContext, input: TParsedInput) => Promise<TOutput> | TOutput;
}
/**
 * Create the base `procedure` builder with a given `TContext`.
 *
 * Example:
 *   const procedure = createProcedure<AppContext>();
 *   const route = procedure
 *     .input(z.object({ foo: z.string() }))
 *     .resolve((ctx, input) => ...)
 */
export declare function createProcedure<TContext>(): ProcedureBuilder<TContext, null, unknown>;
