import React from "react"
import { Button } from "@/components/ui/button"
import { useExtensionState } from "../../context/ExtensionStateContext"
import { vscode } from "@/utils/vscode"
import { formatPrice } from "../ApiOptions/utils"
import { getKoduAddCreditsUrl, getKoduOfferUrl, getKoduSignInUrl } from "../../../../src/shared/kodu"
import { GiftIcon } from "lucide-react"

const UserInfoSection: React.FC = () => {
	const extensionState = useExtensionState()

	if (extensionState.user === undefined) {
		return (
			<Button
				onClick={() => {
					vscode.postTrackingEvent("AuthStart")
				}}
				asChild>
				<a href={getKoduSignInUrl(extensionState.uriScheme, extensionState.extensionName)}>Sign in to Kodu</a>
			</Button>
		)
	}

	return (
		<>
			<div className="flex max-[280px]:items-start max-[280px]:flex-col max-[280px]:space-y-2 flex-row justify-between items-center">
				<div>
					<p className="text-xs font-medium">Signed in as</p>
					<p className="text-sm font-bold">{extensionState.user?.email}</p>
					<Button
						variant="link"
						size="sm"
						className="text-sm !text-muted-foreground"
						onClick={() => vscode.postMessage({ type: "didClickKoduSignOut" })}>
						sign out
					</Button>
				</div>
				<div className="max-[280px]:mt-2">
					<p className="text-xs font-medium">Credits remaining</p>
					<p className="text-lg font-bold">{formatPrice(extensionState.user?.credits || 0)}</p>
				</div>
			</div>
			<div className="flex gap-2 flex-wrap">
				<Button
					onClick={() => {
						vscode.postTrackingEvent("ExtensionCreditAddOpen")
						vscode.postTrackingEvent("ExtensionCreditAddSelect", "purchase")
					}}
					asChild>
					<a href={getKoduAddCreditsUrl(extensionState.uriScheme)}>Add Credits</a>
				</Button>
				<Button
					onClick={() => {
						vscode.postTrackingEvent("OfferwallView")
						vscode.postTrackingEvent("ExtensionCreditAddSelect", "offerwall")
					}}
					variant={"outline"}
					asChild>
					<a href={getKoduOfferUrl(extensionState.uriScheme)}>
						<GiftIcon className="size-4 mr-1" />
						$10 Free Credits
					</a>
				</Button>
			</div>
		</>
	)
}

export default UserInfoSection
