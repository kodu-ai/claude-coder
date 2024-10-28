import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import React, { useState, useCallback, useRef, useEffect, memo, useDeferredValue } from "react"
import { Button } from "../ui/button"
import { motion, AnimatePresence } from "framer-motion"
import { vscode } from "@/utils/vscode"
import { AlertCircle } from "lucide-react"
import { useTransition } from "react"

interface ButtonSectionProps {
	primaryButtonText: string | undefined
	secondaryButtonText: string | undefined
	enableButtons: boolean
	handlePrimaryButtonClick: () => void
	handleSecondaryButtonClick: () => void
	isRequestRunning: boolean
}

function ButtonSection({
	primaryButtonText,
	secondaryButtonText,
	enableButtons,
	handlePrimaryButtonClick,
	isRequestRunning,
	handleSecondaryButtonClick,
}: ButtonSectionProps) {
	const [isAborting, setIsAborting] = useState(false)
	const [isPending, startTransition] = useTransition()

	// Defer button text updates to avoid flicker
	const deferredPrimaryText = useDeferredValue(primaryButtonText)
	const deferredSecondaryText = useDeferredValue(secondaryButtonText)
	const deferredEnableButtons = useDeferredValue(enableButtons)

	const showAbortButton = isRequestRunning && !deferredEnableButtons
	const showActionButtons = deferredEnableButtons && (deferredPrimaryText || deferredSecondaryText)

	const handleAbort = useCallback(() => {
		startTransition(() => {
			setIsAborting(true)
			vscode.postMessage({ type: "cancelCurrentRequest" })
		})
	}, [])

	const handlePrimaryClick = useCallback(() => {
		startTransition(() => {
			handlePrimaryButtonClick()
		})
	}, [handlePrimaryButtonClick])

	const handleSecondaryClick = useCallback(() => {
		startTransition(() => {
			handleSecondaryButtonClick()
		})
	}, [handleSecondaryButtonClick])

	if (!showAbortButton && !showActionButtons) return null

	return (
		<div className="flex flex-col gap-2 px-4 pt-2">
			{showAbortButton && (
				<Button
					disabled={isAborting || isPending}
					onClick={handleAbort}
					className="w-full"
					variant="destructive">
					Abort Request
				</Button>
			)}

			{showActionButtons && (
				<div className="flex flex-1 w-full">
					{deferredPrimaryText && (
						<Button
							size="sm"
							disabled={!deferredEnableButtons || isPending}
							className={`flex-1 ${deferredSecondaryText ? "mr-1.5" : ""}`}
							onClick={handlePrimaryClick}>
							{deferredPrimaryText}
						</Button>
					)}
					{deferredSecondaryText && (
						<Button
							size="sm"
							variant="secondary"
							disabled={!deferredEnableButtons || isPending}
							className="flex-1 ml-1.5"
							onClick={handleSecondaryClick}>
							{deferredSecondaryText}
						</Button>
					)}
				</div>
			)}
		</div>
	)
}

export default ButtonSection
