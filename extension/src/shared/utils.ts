export function mergeAbortSignals(...signals: (AbortSignal | undefined | null)[]): AbortSignal {
	// remove null and undefined signals
	const cleanSignals = signals.filter((s) => s !== null && s !== undefined) as AbortSignal[]
	if (cleanSignals.length === 0) {
		return new AbortSignal()
	}
	return AbortSignal.any(cleanSignals)
}

export class SmartAbortSignal {
	private controller: AbortController
	private timeoutId: ReturnType<typeof setTimeout> | null

	constructor(timeout?: number) {
		this.controller = new AbortController()
		this.timeoutId = null

		// Set timeout if provided
		if (timeout !== undefined) {
			this.timeoutId = setTimeout(() => {
				this.abort() // Auto-abort when timeout expires
			}, timeout)
		}
	}

	/** Get the underlying AbortSignal */
	get signal(): AbortSignal {
		return this.controller.signal
	}

	/** Check if the signal is already aborted */
	get aborted(): boolean {
		return this.controller.signal.aborted
	}

	/** Manually abort the signal and clear any pending timeout */
	abort(): void {
		this.clear() // Clear timeout first
		this.controller.abort()
	}

	/** Clear the timeout (does NOT abort the signal) */
	clear(): void {
		if (this.timeoutId) {
			clearTimeout(this.timeoutId)
			this.timeoutId = null
		}
	}
}
