import type { ProcedureInstance } from "./procedure";
/**
 * A 'Router' is an object whose keys are 'ProcedureInstance' objects.
 */
export type Router = Record<string, ProcedureInstance<any, any, any>>;
/**
 * Create a router from an object literal that maps routeName -> ProcedureInstance.
 *
 * Usage:
 * const myRouter = router({
 *   getUser: procedure.input(...).resolve(...),
 *   createUser: procedure.input(...).resolve(...),
 * })
 */
export declare function router<T extends Router>(routes: T): T;
/**
 * Merge any number of routers, returning a combined type.
 *
 * Usage:
 * const appRouter = mergeRouters(userRouter, postRouter, commentRouter, authRouter)
 *
 * @param routers - Any number of Router instances to merge
 * @returns A merged router containing all routes from input routers
 */
export declare function mergeRouters<T extends Router[]>(...routers: [...T]): UnionToIntersection<T[number]>;
/**
 * Utility type to convert a union type to an intersection type
 * This ensures the merged router has all properties from all input routers
 */
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never;
export {};
