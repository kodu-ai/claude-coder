import { ErrorObject } from "serialize-error"

export interface KnownError extends Error {
	message: string
}

export type SerializedError = string | ErrorObject

export function isKnownError(error: unknown): error is KnownError {
	return error instanceof Error && typeof (error as Error).message === "string"
}

export function getErrorMessage(error: unknown): string {
	if (isKnownError(error)) {
		return error.message
	}
	if (typeof error === "string") {
		return error
	}
	return "An unknown error occurred"
}
