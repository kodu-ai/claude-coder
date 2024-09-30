import React, { useEffect, useRef, useState } from "react"
import { VSCodeButton, VSCodeLink } from "@vscode/webview-ui-toolkit/react"
import { formatPrice } from "../ApiOptions/utils"
import { getKoduAddCreditsUrl, getKoduOfferUrl, getKoduReferUrl, getKoduSignInUrl } from "../../../../src/shared/kodu"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover"
import { Button } from "../ui/button"
import { Users, Gift, CreditCard, Sparkles, BadgeCheck, Zap } from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "../ui/card"
import { vscode } from "@/utils/vscode"

interface CreditsInfoProps {
	koduCredits?: number
	vscodeUriScheme?: string
}

const CreditsInfo: React.FC<CreditsInfoProps> = ({ koduCredits, vscodeUriScheme }) => {
	const { user } = useExtensionState()
	const [isOpen, setIsOpen] = useState(false)
	useEffect(() => {
		return () => {
			console.log("cleanup")
			setIsOpen(false)
		}
	}, [])
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
				<>
					{" "}
					<Popover open={isOpen} onOpenChange={setIsOpen}>
						<PopoverTrigger asChild>
							<VSCodeLink style={{ fontSize: "0.9em" }}>
								{
									// eslint-disable-next-line no-nested-ternary
									user?.isVisitor ? <>{"(Earn 10$ for free)"}</> : <>{"(add more)"}</>
								}
							</VSCodeLink>
						</PopoverTrigger>
						<PopoverContent
							avoidCollisions
							collisionPadding={8}
							// sideOffset={10}
							// alignOffset={!user?.isVisitor ? -100 : -10}
							alignOffset={-8}
							align="center"
							// side=""
							className="p-0 !bg-transparent !border-none">
							{user?.isVisitor ? <SignupContent /> : <AddCreditsContent />}
						</PopoverContent>
					</Popover>
				</>
			</div>
		</div>
	)
}

const SignupContent = () => {
	const { uriScheme, extensionName } = useExtensionState()

	return (
		<Card className="border-0 rounded-md overflow-hidden max-w-[90vw] mx-auto">
			<CardHeader className="pb-3 bg-gradient-to-r from-purple-500 to-blue-500 text-white">
				<CardTitle className="text-lg sm:text-2xl font-bold break-words">Get $10 Free Credit!</CardTitle>
				<CardDescription className="text-white/90 text-xs sm:text-sm">
					Create your Kodu.ai account now
				</CardDescription>
			</CardHeader>
			<CardContent className="pt-4 pb-2">
				<div className="mb-4 text-center">
					<Sparkles className="h-8 w-8 sm:h-12 sm:w-12 mx-auto mb-2 text-yellow-400" />
					<p className="text-sm sm:text-lg font-semibold text-primary break-words">
						Unlock AI-Powered Creativity
					</p>
				</div>
				<div className="space-y-2">
					{[
						"Access cutting-edge AI tools",
						"24/7 support from AI experts",
						"Join a thriving creator community",
					].map((text, index) => (
						<div key={index} className="flex items-start space-x-2">
							<BadgeCheck className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 flex-shrink-0 mt-0.5" />
							<p className="text-xs sm:text-sm break-words">{text}</p>
						</div>
					))}
				</div>
			</CardContent>
			<div className="p-2 sm:p-4">
				<Button
					onClick={() => {
						vscode.postMessage({
							type: "openExternalLink",
							url: getKoduSignInUrl(uriScheme, extensionName),
						})
					}}
					className="border-0 w-full bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:from-purple-600 hover:to-blue-600 text-xs sm:text-sm py-1 sm:py-2">
					<Zap className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
					Create Account & Claim $10
				</Button>
			</div>
		</Card>
	)
}

const AddCreditsContent = () => {
	return (
		<Card className=" rounded-md overflow-hidden max-w-[90vw] mx-auto">
			<CardHeader className="pb-3">
				<CardTitle>Get More Credit</CardTitle>
				<CardDescription>Choose an option to increase your credit.</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-2 p-2">
				<Button
					onClick={() => {
						vscode.postMessage({
							type: "openExternalLink",
							url: getKoduReferUrl(),
						})
					}}
					variant="ghost"
					className="w-full justify-start text-left h-auto p-3 hover:bg-accent">
					<div className="flex items-center space-x-4">
						<Users className="h-5 w-5 shrink-0" />
						<div className="flex-1 space-y-1">
							<p className="text-sm font-medium leading-none">Refer a friend</p>
							<p className="text-xs text-muted-foreground">Max 500 USD</p>
						</div>
					</div>
				</Button>
				<Button
					onClick={() => {
						vscode.postMessage({
							type: "openExternalLink",
							url: getKoduOfferUrl(),
						})
					}}
					variant="ghost"
					className="w-full justify-start text-left h-auto p-3 hover:bg-accent">
					<div className="flex items-center space-x-4">
						<Gift className="h-5 w-5 shrink-0" />
						<div className="flex-1 space-y-1">
							<p className="text-sm font-medium leading-none">Check our Offer wall</p>
							<p className="text-xs text-muted-foreground">Max 10 USD</p>
						</div>
					</div>
				</Button>
				<Button
					onClick={() => {
						vscode.postMessage({
							type: "openExternalLink",
							url: getKoduAddCreditsUrl(),
						})
					}}
					variant="ghost"
					className="w-full justify-start text-left h-auto p-3 hover:bg-accent">
					<div className="flex items-center space-x-4">
						<CreditCard className="h-5 w-5 shrink-0" />
						<div className="flex-1 space-y-1">
							<p className="text-sm font-medium leading-none">Buy Credits</p>
						</div>
					</div>
				</Button>
			</CardContent>
		</Card>
	)
}

export default CreditsInfo
