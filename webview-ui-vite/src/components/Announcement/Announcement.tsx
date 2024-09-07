import React from "react"
import { ApiConfiguration } from "../../../../src/api"
import AnnouncementHeader from "./AnnouncementHeader"
import AnnouncementContent from "./AnnouncementContent"

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
