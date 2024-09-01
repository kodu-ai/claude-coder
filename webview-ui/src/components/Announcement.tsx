import { VSCodeButton, VSCodeLink } from "@vscode/webview-ui-toolkit/react"
import { getKoduSignInUrl } from "../../../src/shared/kodu"
import VSCodeButtonLink from "./VSCodeButtonLink"
import { ApiConfiguration } from "../../../src/api"

interface AnnouncementProps {
	version: string
	hideAnnouncement: () => void
	apiConfiguration?: ApiConfiguration
	vscodeUriScheme?: string
}
/*
You must update the latestAnnouncementId in ClaudeDevProvider for new announcements to show to users. This new id will be compared with whats in state for the 'last announcement shown', and if it's different then the announcement will render. As soon as an announcement is shown, the id will be updated in state. This ensures that announcements are not shown more than once, even if the user doesn't close it themselves.
*/
const Announcement = ({ version, hideAnnouncement, apiConfiguration, vscodeUriScheme }: AnnouncementProps) => {
	return (
		<div
			style={{
				backgroundColor: "var(--vscode-editor-inactiveSelectionBackground)",
				borderRadius: "3px",
				padding: "12px 16px",
				margin: "5px 15px 5px 15px",
				position: "relative",
			}}>
			<VSCodeButton
				appearance="icon"
				onClick={hideAnnouncement}
				style={{ position: "absolute", top: "8px", right: "8px" }}>
				<span className="codicon codicon-close"></span>
			</VSCodeButton>
			<h3 style={{ margin: "0 0 8px" }}>
				🎉{"  "}New in v{version}
			</h3>

			<ul style={{ margin: "0 0 8px", paddingLeft: "12px" }}>
				<li>
					Excited to announce that we've partnered with Anthropic and are offering <b>$10 free credits</b> to
					help users get the most out of Kodu Dev with increased rate limits and prompt caching! Stay tuned
					for some exciting updates like easier billing, voice mode and one click deployment!
				</li>
				<li>
					Added "Creativity Mode" you can play between "Normal", "Creative" and "Deterministic" modes to
					experience different levels of creativity and control over generated code.
				</li>
				<li>
					Added "Experimental Automatic" mode to let Claude automatically read, write and execute files
					without needing to approve (off by default).
				</li>
			</ul>
			{/* <p style={{ margin: "0" }}>
				Follow me for more updates!{" "}
				<VSCodeLink href="https://x.com/wekodu" style={{ display: "inline" }}>
					@kodu-ai
				</VSCodeLink>
			</p> */}
		</div>
	)
}

export default Announcement
