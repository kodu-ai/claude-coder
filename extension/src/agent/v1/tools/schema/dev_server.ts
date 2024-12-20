// schema/dev_server.ts
import { z } from "zod"

/**
 * @tool dev_server
 * @description Manage a development server by starting, stopping, restarting, or retrieving logs. This tool allows for flexible control over the development environment.
 * @schema
 * {
 *   commandType: "start" | "stop" | "restart" | "getLogs";  // The type of operation to perform on the dev server.
 *   commandToRun: string;                                   // The specific command to execute for the operation.
 * }
 * @example
 * ```xml
 * <tool name="dev_server">
 *   <commandType>start</commandType>
 *   <commandToRun>npm run dev</commandToRun>
 * </tool>
 * ```
 * @example
 * ```xml
 * <tool name="dev_server">
 *   <commandType>stop</commandType>
 *   <commandToRun>npm run stop</commandToRun>
 * </tool>
 * ```
 * @example
 * ```xml
 * <tool name="dev_server">
 *   <commandType>restart</commandType>
 *   <commandToRun>npm run dev</commandToRun>
 * </tool>
 * ```
 * @example
 * ```xml
 * <tool name="dev_server">
 *   <commandType>getLogs</commandType>
 *   <commandToRun></commandToRun>
 * </tool>
 * ```
 */
const schema = z.object({
	commandType: z
		.enum(["start", "stop", "restart", "getLogs"])
		.optional()
		.describe(
			"The type of operation to perform on the dev server. 'start' begins the server, 'stop' terminates it, 'restart' stops then starts the server, and 'getLogs' retrieves the server logs."
		),
	serverName: z.string().optional().describe("The name of the terminal to use for the operation."),
	commandToRun: z
		.string()
		.optional()
		.describe(
			"The specific command to execute for the operation. For 'start' and 'restart', this is typically the command to start your dev server (e.g., 'npm run dev'). For 'stop', it's the command to stop the server. For 'getLogs', this can be left empty."
		),
	lines: z.string().default("-1").optional().describe("The number of lines to retrieve from the logs."),
})

export type DevServerParams = z.infer<typeof schema>

const examples = [
	`<tool name="dev_server">
  <commandType>start</commandType>
  <commandToRun>npm run dev</commandToRun>
</tool>`,

	`<tool name="dev_server">
  <commandType>stop</commandType>
  <commandToRun>npm run stop</commandToRun>
</tool>`,

	`<tool name="dev_server">
  <commandType>restart</commandType>
  <commandToRun>npm run dev</commandToRun>
</tool>`,

	`<tool name="dev_server">
  <commandType>getLogs</commandType>
  <commandToRun></commandToRun>
</tool>`,

	`<tool name="dev_server">
  <commandType>getLogs</commandType>
  <commandToRun></commandToRun>
  <lines>10</lines>
</tool>`,
]

export const devServerTool = {
	schema: {
		name: "server_runner",
		schema,
	},
	examples,
}

export type ServerRunnerToolParams = {
	name: "server_runner"
	input: z.infer<typeof schema>
}
