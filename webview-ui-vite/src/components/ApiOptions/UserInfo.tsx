import React from "react"
import { VSCodeLink } from "@vscode/webview-ui-toolkit/react"
import { vscode } from "../../utils/vscode"
import VSCodeButtonLink from "../VSCodeButtonLink/VSCodeButtonLink"
import { formatPrice } from "./utils"
import { getKoduAddCreditsUrl, getKoduReferUrl, getKoduSignInUrl } from "../../../../src/shared/kodu"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { Button } from "../ui/button"

interface UserInfoProps {
	user: any
	uriScheme?: string
	setDidAuthKodu?: React.Dispatch<React.SetStateAction<boolean>>
}

const UserInfo: React.FC<UserInfoProps> = ({ user, uriScheme, setDidAuthKodu }) => {
	const { extensionName } = useExtensionState()
	if (user !== undefined) {
		return (
			<>
				<div style={{ marginBottom: 5, marginTop: 3 }}>
					<span style={{ color: "var(--vscode-descriptionForeground)" }}>
						Signed in as {user?.email || "Unknown"}
					</span>{" "}
					<Button
						variant="link"
						size="sm"
						style={{ display: "inline" }}
						onClick={() => vscode.postMessage({ type: "didClickKoduSignOut" })}>
						(sign out?)
					</Button>
				</div>
				<div style={{ marginBottom: 7 }}>
					Credits remaining:{" "}
					<span style={{ fontWeight: 500, opacity: user !== undefined ? 1 : 0.6 }}>
						{formatPrice(user?.credits || 0)}
					</span>
				</div>
				<div
					style={{
						display: "flex",
						flexWrap: "wrap",
						gap: 10,
						marginBottom: 5,
					}}>
					<Button
						onClick={() => {
							vscode.postTrackingEvent("ReferralProgram")
						}}
						style={{
							width: "fit-content",
							marginRight: 10,
						}}
						asChild>
						<a href={getKoduReferUrl(uriScheme)}>Referral Program</a>
					</Button>
					<Button
						onClick={() => {
							vscode.postTrackingEvent("ExtensionCreditAddOpen")
						}}
						asChild
						style={{
							width: "fit-content",
						}}>
						<a href={getKoduAddCreditsUrl(uriScheme)}>Add Credits</a>
					</Button>
				</div>
			</>
		)
	} else {
		return (
			<div style={{ margin: "4px 0px" }}>
				<Button
					asChild
					onClick={() => {
						vscode.postTrackingEvent("AuthStart")
						setDidAuthKodu?.(true)
					}}>
					<a href={getKoduSignInUrl(uriScheme, extensionName)}>Sign in to Kodu</a>
				</Button>
			</div>
		)
	}
}

export default UserInfo
