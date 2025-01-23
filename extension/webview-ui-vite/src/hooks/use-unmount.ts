import { useEffect, useRef } from "react"

export function useUnmount(func: () => void) {
	const funcRef = useRef(func)

	funcRef.current = func

	useEffect(
		() => () => {
			funcRef.current()
		},
		[]
	)
}
