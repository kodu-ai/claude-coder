import React, { Dispatch, SetStateAction, useCallback } from "react"
import { useEvent } from "react-use"
import { ExtensionMessage } from "../../../src/shared/ExtensionMessage"
import { MAX_IMAGES_PER_MESSAGE } from "./use-image-handler"
import { selectedImagesAtom } from "@/components/chat-view/atoms"
import { useAtom, useSetAtom } from "jotai"

/**
 * @description Hook that listens for messages from the extension and updates the selected images
 */
export const useSelectImages = () => {
	const [images, setSelectedImages] = useAtom(selectedImagesAtom)
	const handleMessage = useCallback(
		(e: MessageEvent) => {
			const message: ExtensionMessage = e.data
			if (message.type === "selectedImages") {
				if (message.images?.length && Array.isArray(message.images)) {
					const newImages = [...images, ...message.images!].slice(-MAX_IMAGES_PER_MESSAGE)
					setSelectedImages(newImages)
				}
			}
		},
		[setSelectedImages, images]
	)

	useEvent("message", handleMessage)
}
