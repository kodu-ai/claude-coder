import type React from 'react'
import { useLayoutEffect, useRef } from 'react'
import { useWindowSize } from 'react-use'
import ThumbnailItem from './ThumbnailItem'

interface ThumbnailsProps {
	images: string[]
	style?: React.CSSProperties
	setImages?: React.Dispatch<React.SetStateAction<string[]>>
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
	}, [images, width, onHeightChange])

	const handleDelete = (index: number) => {
		setImages?.((prevImages) => prevImages.filter((_, i) => i !== index))
	}

	const isDeletable = setImages !== undefined

	return (
		<div
			className=""
			ref={containerRef}
			style={{
				display: 'flex',
				flexWrap: 'wrap',
				gap: 5,
				rowGap: 3,
				...style,
			}}
		>
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
