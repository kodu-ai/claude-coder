import { KoduModelId } from "@/services/kodu-api/kodu-api-models";
import { HistoryItem } from "./history-item";

type User = {
	email: string
	credits: number
	id: string
	isVisitor: boolean
}

type CreativeMode = "creative" | "normal" | "deterministic"

export type GlobalState = {
	user: User | undefined | null
	maxRequestsPerTask: number | undefined
	lastShownAnnouncementId: string | undefined
	customInstructions: string | undefined
	apiModelId: KoduModelId | undefined
	useUdiff: boolean | undefined
	alwaysAllowReadOnly: boolean | undefined
	alwaysAllowWriteOnly: boolean | undefined
	taskHistory: HistoryItem[] | undefined
	shouldShowKoduPromo: boolean | undefined
	creativeMode: CreativeMode | undefined
	autoCloseTerminal: boolean | undefined
	experimentalTerminal: boolean | undefined
	skipWriteAnimation: boolean | undefined
	technicalBackground: "no-technical" | "technical" | "developer" | undefined
}