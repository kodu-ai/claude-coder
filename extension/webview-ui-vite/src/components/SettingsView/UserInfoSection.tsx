import React from "react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { formatPrice } from "../ApiOptions/utils"
import { getKoduAddCreditsUrl, getKoduOfferUrl } from "../../../../src/shared/kodu"
import { vscode } from "@/utils/vscode"

interface UserInfoSectionProps {
	email: string | undefined
	credits: number
	uriScheme: string
}

const UserInfoSection: React.FC<UserInfoSectionProps> = ({ email, credits, uriScheme }) => {
	return (
		<div className="mb-4 space-y-3">
			<div className="flex max-[280px]:items-start max-[280px]:flex-col max-[280px]:space-y-2 flex-row justify-between items-center">
				<div>
					<p className="text-xs font-medium">Signed in as</p>
					<p className="text-sm font-bold">{email}</p>
				</div>
				<div className="max-[280px]:mt-2">
					<p className="text-xs font-medium">Credits remaining</p>
					<p className="text-lg font-bold">{formatPrice(credits)}</p>
				</div>
			</div>
			<div className="flex gap-2 flex-wrap">
				<Button
					onClick={() => {
						vscode.postTrackingEvent("ExtensionCreditAddOpen")
						vscode.postTrackingEvent("ExtensionCreditAddSelect", "purchase")
					}}
					asChild>
					<a href={getKoduAddCreditsUrl(uriScheme)}>Add Credits</a>
				</Button>
				<Tooltip>
					<TooltipTrigger>
						<Button
							onClick={() => {
								vscode.postTrackingEvent("OfferwallView")
								vscode.postTrackingEvent("ExtensionCreditAddSelect", "offerwall")
							}}
							variant={"outline"}
							asChild>
							<a href={getKoduOfferUrl(uriScheme)}>Offerwall</a>
						</Button>
					</TooltipTrigger>
					<TooltipContent align="end">Earn up to $10 extra credits for free!</TooltipContent>
				</Tooltip>
			</div>
		</div>
	)
}

export default UserInfoSection
