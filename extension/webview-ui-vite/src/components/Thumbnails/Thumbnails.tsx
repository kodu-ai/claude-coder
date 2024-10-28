import React, { useRef, useLayoutEffect } from "react"
import { useWindowSize } from "react-use"
import ThumbnailItem from "./ThumbnailItem"

interface ThumbnailsProps {
	images: string[]
	style?: React.CSSProperties
	setImages?: (images: string[]) => void
	onHeightChange?: (height: number) => void
}

const Thumbnails: React.FC<ThumbnailsProps> = ({ images, style, setImages, onHeightChange }) => {
	const containerRef = useRef<HTMLDivElement>(null)
	const { width } = useWindowSize()
	useLayoutEffect(() => {
		if (containerRef.current) {
			let height = containerRef.current.clientHeight
			// some browsers return 0 for clientHeight
			if (!height) {
				height = containerRef.current.getBoundingClientRect().height
			}
			onHeightChange?.(height)
		}
	}, [images, width])

	const handleDelete = (index: number) => {
		// setImages?.((prevImages) => prevImages.filter((_, i) => i !== index))
		const newImages = [...images].filter((_, i) => i !== index)
		setImages?.(newImages)
	}

	const isDeletable = setImages !== undefined

	return (
		<div
			className=""
			ref={containerRef}
			style={{
				display: "flex",
				flexWrap: "wrap",
				gap: 5,
				rowGap: 3,
				...style,
			}}>
			{images.map((image, index) => (
				<ThumbnailItem
					key={index}
					image={image}
					index={index}
					isDeletable={isDeletable}
					onDelete={handleDelete}
				/>
			))}
		</div>
	)
}

export default Thumbnails
