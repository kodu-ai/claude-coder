import { ExtensionContext } from "./context"
import { createProcedure } from "./procedure"

// 1) Base procedure that uses ExtensionContext
export const procedure = createProcedure<ExtensionContext>()
