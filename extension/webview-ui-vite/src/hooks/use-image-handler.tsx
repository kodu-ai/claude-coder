import { ChatState } from "@/components/chat-view/chat"
import { useCallback } from "react"
const MAX_IMAGES_PER_MESSAGE = 4 as const

export const useImageHandling = (
	selectedModelSupportsImages: boolean,
	state: ChatState,
	updateState: (updates: Partial<ChatState>) => void
) => {
	const shouldDisableImages =
		!selectedModelSupportsImages || state.textAreaDisabled || state.selectedImages.length >= MAX_IMAGES_PER_MESSAGE

	const handlePaste = useCallback(
		async (e: React.ClipboardEvent) => {
			const items = e.clipboardData.items
			const acceptedTypes = ["png", "jpeg", "webp"]
			const imageItems = Array.from(items).filter((item) => {
				const [type, subtype] = item.type.split("/")
				return type === "image" && acceptedTypes.includes(subtype)
			})

			if (shouldDisableImages && imageItems.length > 0) {
				e.preventDefault()
				return
			}

			if (imageItems.length > 0) {
				e.preventDefault()
				const imagePromises = imageItems.map((item) => {
					return new Promise<string | null>((resolve) => {
						const blob = item.getAsFile()
						if (!blob) {
							resolve(null)
							return
						}
						const reader = new FileReader()
						reader.onloadend = () => {
							if (reader.error) {
								console.error("Error reading file:", reader.error)
								resolve(null)
							} else {
								resolve(typeof reader.result === "string" ? reader.result : null)
							}
						}
						reader.readAsDataURL(blob)
					})
				})

				const imageDataArray = await Promise.all(imagePromises)
				const dataUrls = imageDataArray.filter((dataUrl): dataUrl is string => dataUrl !== null)

				if (dataUrls.length > 0) {
					updateState({
						selectedImages: [...state.selectedImages, ...dataUrls].slice(0, MAX_IMAGES_PER_MESSAGE),
					})
				}
			}
		},
		[shouldDisableImages, state.selectedImages, updateState]
	)

	return {
		shouldDisableImages,
		handlePaste,
	}
}
