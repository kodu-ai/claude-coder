import { vscode } from "@/utils/vscode"
import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import { Button } from "../ui/button"
import { useExtensionState } from "@/context/ExtensionStateContext"

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

const useResetIsPausingNext = ({
	isRequestRunning,
	setIsPausingNext,
}: {
	isRequestRunning: boolean
	setIsPausingNext: (value: boolean) => void
}) => {
	const [currentIsRequestRunning, setCurrentIsRequestRunning] = useState(isRequestRunning)

	useEffect(() => {
		if (currentIsRequestRunning && !isRequestRunning) {
			setIsPausingNext(false)
		}
		setCurrentIsRequestRunning(isRequestRunning)
	}, [isRequestRunning])
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
	const [isPausingNext, setIsPausingNext] = useState(false)
	useResetIsPausingNext({ isRequestRunning, setIsPausingNext })

	const handleAbort = useCallback(() => {
		startTransition(() => {
			vscode.postMessage({ type: "cancelCurrentRequest" })
		})
	}, [])

	const handlePauseNext = useCallback(() => {
		setIsPausingNext(true)
		startTransition(() => {
			vscode.postMessage({ type: "pauseNext" })
		})
	}, [])

	if (isRequestRunning && isAutomaticMode) {
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
					disabled={!isRequestRunning || isPausingNext}
					onClick={handlePauseNext}>
					Pause After
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
