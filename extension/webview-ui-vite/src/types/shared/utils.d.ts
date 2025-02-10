export declare function mergeAbortSignals(...signals: (AbortSignal | undefined | null)[]): AbortSignal;
export declare class SmartAbortSignal {
    private controller;
    private timeoutId;
    constructor(timeout?: number);
    /** Get the underlying AbortSignal */
    get signal(): AbortSignal;
    /** Check if the signal is already aborted */
    get aborted(): boolean;
    /** Manually abort the signal and clear any pending timeout */
    abort(): void;
    /** Clear the timeout (does NOT abort the signal) */
    clear(): void;
}
