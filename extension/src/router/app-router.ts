// app-router.ts

import { createProcedure } from "./utils/procedure"
import { mergeRouters } from "./utils/router"
import { ExtensionContext } from "./utils/context"
import gitRouter from "./routes/git-router"
import taskRouter from "./routes/task-router"
import providerRouter from "./routes/provider-router"
import agentRouter from "./routes/agent-router"

// 3) Merge them into an appRouter
export const appRouter = mergeRouters(taskRouter, gitRouter, providerRouter, agentRouter)

// 4) Export the appRouter type
export type AppRouter = typeof appRouter
