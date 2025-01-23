import { useContext } from "react"
import { CollapseContext } from "../context/collapse-state-context"

export function useCollapseState() {
	const context = useContext(CollapseContext)
	if (context === undefined) {
		throw new Error("useCollapseState must be used within a CollapseProvider")
	}
	return context
}
