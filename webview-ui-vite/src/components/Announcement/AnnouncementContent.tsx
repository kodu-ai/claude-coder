import React from "react"

const AnnouncementContent: React.FC = () => (
	<div className="p-4 bg-gray-100 rounded-lg">
		<h2 className="text-xl font-bold mb-4">Exciting Kodu Updates!</h2>
		<ul className="space-y-2 list-disc pl-5">
			<li>Quick project starter added for faster setup</li>
			<li>New @ command in text area to reference files and sites for scraping</li>
			<li>Improved automatic mode and various bug fixes</li>
			<li>New Terminal shell integration for enhanced functionality</li>
			<li>Autofix Message format on corruption for improved reliability</li>
			<li>Refactored Context Window with improved algorithm</li>
			<li>Enhanced Task search and saving - name tasks and use fuzzy search</li>
			<li>.kodu support for custom configs without breaking system cache</li>
			<li>
				Web Search tool: Claude can now search the web! Try asking to "search for the best" or "how many people
				have starred https://github.com/kodu-ai/kodu-coder"
			</li>
		</ul>
	</div>
)

export default AnnouncementContent
