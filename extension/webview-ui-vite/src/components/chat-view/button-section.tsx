import { vscode } from "@/utils/vscode"
import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import { Button } from "../ui/button"
import { useExtensionState } from "@/context/extension-state-context"

interface ButtonSectionProps {
	primaryButtonText: string | undefined
	secondaryButtonText: string | undefined
	enableButtons: boolean
	handlePrimaryButtonClick: () => void
	handleSecondaryButtonClick: () => void
	isRequestRunning: boolean
}

const useIsAutomaticMode = () => {
	const { alwaysAllowWriteOnly } = useExtensionState()
	return useMemo(() => alwaysAllowWriteOnly, [alwaysAllowWriteOnly])
}

function ButtonSection({
	primaryButtonText,
	secondaryButtonText,
	enableButtons,
	handlePrimaryButtonClick,
	isRequestRunning,
	handleSecondaryButtonClick,
}: ButtonSectionProps) {
	const [isPending, startTransition] = useTransition()
	const isAutomaticMode = useIsAutomaticMode()
	const [isAutomaticPaused, setIsAutomaticPaused] = useState(false)
	const isAnyMessageResumeTask =
		primaryButtonText?.includes("Resume Task") || secondaryButtonText?.includes("Resume Task")
	const handleAbort = useCallback(() => {
		startTransition(() => {
			vscode.postMessage({ type: "cancelCurrentRequest" })
		})
	}, [])

	const handlePauseOrResumeAutomatic = useCallback(() => {
		setIsAutomaticPaused(!isAutomaticPaused)
		console.log(`Pause or Resume Automatic: ${!isAutomaticPaused}`)
		startTransition(() => {
			vscode.postMessage({ type: "pauseTemporayAutoMode", mode: !isAutomaticPaused })
		})
	}, [isAutomaticPaused])

	if (
		isAutomaticMode &&
		!isAnyMessageResumeTask &&
		!(isAutomaticPaused && primaryButtonText && secondaryButtonText)
	) {
		return (
			<div className="z-50 grid grid-cols-2 gap-2 px-4 pt-2">
				<Button
					size="sm"
					className="transition-colors duration-200 ease-in-out"
					variant="destructive"
					disabled={!isRequestRunning}
					onClick={handleAbort}>
					Abort Request
				</Button>
				<Button
					size="sm"
					className="transition-colors duration-200 ease-in-out"
					variant="secondary"
					onClick={handlePauseOrResumeAutomatic}>
					{isAutomaticPaused ? "Resume Automatic" : "Pause Automatic"}
				</Button>
			</div>
		)
	}

	if (!primaryButtonText && !isRequestRunning) return null

	if (isRequestRunning && !secondaryButtonText) {
		return (
			<div className="z-50 flex flex-col gap-2 space-x-2 px-4 pt-2">
				<Button
					size="sm"
					className="transition-colors duration-200 ease-in-out"
					variant="destructive"
					disabled={!enableButtons && !isRequestRunning}
					onClick={handleAbort}>
					Abort Request
				</Button>
			</div>
		)
	}

	return (
		<div className="z-50 grid grid-cols-2 gap-2 px-4 pt-2">
			<Button
				size="sm"
				className={!secondaryButtonText ? "col-span-2" : ""}
				disabled={!enableButtons || isPending}
				onClick={() => startTransition(() => handlePrimaryButtonClick())}>
				{primaryButtonText}
			</Button>
			{secondaryButtonText && (
				<Button
					size="sm"
					variant="secondary"
					disabled={!enableButtons || isPending}
					onClick={() => startTransition(() => handleSecondaryButtonClick())}>
					{secondaryButtonText}
				</Button>
			)}
		</div>
	)
}

export default ButtonSection
