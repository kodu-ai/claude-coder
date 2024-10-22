export const formatDate = (timestamp: number): string => {
	const date = new Date(timestamp)
	return date
		.toLocaleString('en-US', {
			month: 'long',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit',
			hour12: true,
		})
		.replace(', ', ' ')
		.replace(' at', ',')
		.toUpperCase()
}
