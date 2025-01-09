import { z } from "zod"
import { procedure } from "../utils"
import { router } from "../utils/router"

const gitRouter = router({
	toggleGitHandler: procedure.input(z.object({ enabled: z.boolean() })).resolve(async (ctx, input) => {
		ctx.provider?.getStateManager()?.setGitHandlerEnabled(input.enabled)
		return { success: true }
	}),
})

export default gitRouter
