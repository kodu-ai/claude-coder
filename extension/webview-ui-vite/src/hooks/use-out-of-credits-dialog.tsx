import { useState, useCallback } from "react"

export const useOutOfCreditDialog = () => {
	const [shouldOpenOutOfCreditDialog, setShouldOpenOutOfCreditDialog] = useState(false)

	const openOutOfCreditDialog = useCallback(() => {
		setShouldOpenOutOfCreditDialog(true)
	}, [])

	return {
		shouldOpenOutOfCreditDialog,
		openOutOfCreditDialog,
	}
}
