// atoms.ts
import { atom } from "jotai"

import vsDarkPlus from "react-syntax-highlighter/dist/esm/styles/prism/vsc-dark-plus"
import { Resource } from "../../../../src/shared/WebviewMessage"

export const attachmentsAtom = atom<Resource[]>([])
export const syntaxHighlighterAtom = atom(vsDarkPlus)
