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

const isValidStringOrNull = (str: string | undefined | null) => {
	return typeof str === "string" && str.length > 0
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
	const isRequireUserInput =
		primaryButtonText?.includes("Resume Task") ||
		secondaryButtonText?.includes("Resume Task") ||
		primaryButtonText?.includes("Start New Task") ||
		secondaryButtonText?.includes("Start New Task") ||
		primaryButtonText?.includes("Mark as Completed") ||
		secondaryButtonText?.includes("Mark as Incomplete")

	const handlePauseOrResumeAutomatic = useCallback(() => {
		setIsAutomaticPaused(!isAutomaticPaused)
		startTransition(() => {
			vscode.postMessage({ type: "pauseTemporayAutoMode", mode: !isAutomaticPaused })
		})
	}, [isAutomaticPaused])

	if (isAutomaticMode && !isRequireUserInput && !(isAutomaticPaused && primaryButtonText && secondaryButtonText)) {
		return (
			<div className="z-50 px-4 pt-2 flex">
				<Button
					size="sm"
					className="transition-colors duration-200 ease-in-out flex-1 flex-grow"
					variant="secondary"
					onClick={handlePauseOrResumeAutomatic}>
					{isAutomaticPaused ? "Resume Automatic" : "Pause Automatic"}
				</Button>
			</div>
		)
	}

	if (!isValidStringOrNull(primaryButtonText)) return null

	return (
		<div className="z-50 flex flex-wrap gap-2 px-4 pt-2 items-stretch">
			<Button
				size="sm"
				className={"flex-1"}
				disabled={!enableButtons || isPending}
				onClick={() => startTransition(() => handlePrimaryButtonClick())}>
				{primaryButtonText}
			</Button>
			{secondaryButtonText && (
				<Button
					size="sm"
					variant="secondary"
					className="flex-1"
					disabled={!enableButtons || isPending}
					onClick={() => startTransition(() => handleSecondaryButtonClick())}>
					{secondaryButtonText}
				</Button>
			)}
		</div>
	)
}

export default ButtonSection
