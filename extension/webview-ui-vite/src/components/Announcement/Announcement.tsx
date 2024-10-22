import type React from 'react'
import type { ApiConfiguration } from '../../../../src/api'
import AnnouncementContent from './AnnouncementContent'
import AnnouncementHeader from './AnnouncementHeader'

interface AnnouncementProps {
	version: string
	hideAnnouncement: () => void
	apiConfiguration?: ApiConfiguration
	vscodeUriScheme?: string
}

const Announcement: React.FC<AnnouncementProps> = ({ version, hideAnnouncement }) => {
	return (
		<section className="text-start">
			<AnnouncementHeader version={version} onClose={hideAnnouncement} />
			<AnnouncementContent />
		</section>
	)
}

export default Announcement
