import React from "react"
import { VSCodeLink } from "@vscode/webview-ui-toolkit/react"
import { formatPrice } from "../ApiOptions/utils"
import { getKoduAddCreditsUrl } from "../../../../src/shared/kodu"

interface CreditsInfoProps {
	koduCredits?: number
	vscodeUriScheme?: string
}

const CreditsInfo: React.FC<CreditsInfoProps> = ({ koduCredits, vscodeUriScheme }) => {
	return (
		<div
			style={{
				backgroundColor: "color-mix(in srgb, var(--section-border) 50%, transparent)",
				color: "var(--vscode-activityBar-foreground)",
				borderRadius: "0 0 3px 3px",
				display: "flex",
				justifyContent: "space-between",
				alignItems: "center",
				padding: "4px 12px 6px 12px",
				fontSize: "0.9em",
				marginLeft: "10px",
				marginRight: "10px",
			}}>
			<div style={{ fontWeight: "500" }}>Credits Remaining:</div>
			<div>
				{formatPrice(koduCredits || 0)}
				{(koduCredits || 0) < 1 && (
					<>
						{" "}
						<VSCodeLink style={{ fontSize: "0.9em" }} href={getKoduAddCreditsUrl(vscodeUriScheme)}>
							(get more?)
						</VSCodeLink>
					</>
				)}
			</div>
		</div>
	)
}

export default CreditsInfo
