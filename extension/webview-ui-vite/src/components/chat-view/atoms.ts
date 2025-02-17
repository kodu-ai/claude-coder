// atoms.ts
import { atom, PrimitiveAtom } from "jotai"

import vsDarkPlus from "react-syntax-highlighter/dist/esm/styles/prism/vsc-dark-plus"
import { Resource } from "extension/shared/messages/client-message"
import { ChatState } from "./chat"
import { SetStateAction } from "react"

export const attachmentsAtom = atom<Resource[]>([])
export const syntaxHighlighterAtom = atom(vsDarkPlus)

export const chatStateAtom = atom<ChatState>({
	inputValue: "",
	textAreaDisabled: false,
	selectedImages: [],
	thumbnailsHeight: 0,
	claudeAsk: undefined,
	enableButtons: false,
	primaryButtonText: undefined,
	secondaryButtonText: undefined,
	expandedRows: {},
	isAbortingRequest: false,
	prevInputValue: "",
	prevImages: [],
})

export const selectedImagesAtom = atom(
	(get) => get(chatStateAtom).selectedImages,
	(_get, set, newImages: string[]) => {
		set(chatStateAtom, (prev) => ({ ...prev, selectedImages: newImages }))
	}
)
