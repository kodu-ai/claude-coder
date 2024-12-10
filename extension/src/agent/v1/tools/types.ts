import { z } from "zod"
import { KoduDev } from ".."
import { ClaudeAsk, ClaudeSay } from "../../../shared/ExtensionMessage"
import { AskDetails } from "../task-executor/utils"

export interface AgentToolOptions {
	cwd: string
	alwaysAllowReadOnly?: boolean
	alwaysAllowWriteOnly?: boolean
	koduDev: KoduDev
	setRunningProcessId?: (pid: number | undefined) => void
}

export interface AgentToolParams {
	name: string
	input: Record<string, any>
	id: string
	ts: number
	isFinal: boolean
	isLastWriteToFile: boolean
	ask: (type: ClaudeAsk, data: AskDetails, ts?: number) => Promise<any>
	say: (type: ClaudeSay, text?: string, images?: string[]) => Promise<number>
	updateAsk: (type: ClaudeAsk, data: AskDetails, ts: number) => Promise<void>
}

export interface ToolSchema {
	name: string
	schema:
		| z.ZodObject<any>
		| {
				name: string
				schema: z.ZodObject<any>
		  }
}

export interface ToolResponseBase {
	toolName: string
	toolId: string
	status: "success" | "error" | "feedback"
	text: string
	images?: string[]
	branch?: string
	commitHash?: string
	preCommitHash?: string
}

export type ToolResponse = ToolResponseBase | string

export interface CommitInfo {
	hash: string
	branch: string
	preCommitHash?: string
}
