import React from "react"
import { Button } from "@/components/ui/button"
import {
	AlertDialog,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Sparkles, Zap, Rocket, Gift } from "lucide-react"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { loginKodu } from "@/utils/kodu-links"
import { vscode } from "@/utils/vscode"

export default function EndOfTrialAlertDialog() {
	const { user, uriScheme, extensionName } = useExtensionState()

	const isOpen = user && user.isVisitor && user.credits < 0.1

	React.useEffect(() => {
		vscode.postTrackingEvent("TrialUpsellView")
	}, [])

	return (
		<AlertDialog open={!!isOpen} onOpenChange={() => { }}>
			<AlertDialogContent className="w-[90vw] max-w-[425px] p-3 sm:p-6 rounded-md">
				<AlertDialogHeader className="space-y-2 sm:space-y-3">
					<AlertDialogTitle className="text-lg sm:text-2xl font-bold flex items-center gap-2">
						<Sparkles className="h-4 w-4 sm:h-6 sm:w-6 text-yellow-400 flex-shrink-0" />
						<span className="break-words">Your free trial has ended!</span>
					</AlertDialogTitle>
					<AlertDialogDescription className="text-sm sm:text-base">
						Continue your AI journey here.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<div className="grid gap-3 sm:gap-4 py-2 sm:py-4">
					<div className="bg-gradient-to-r from-purple-100 to-blue-100 p-2 sm:p-4 rounded-lg border-2 border-purple-300 shadow-md">
						<h3 className="text-sm sm:text-lg font-bold text-purple-700 flex items-center gap-2 mb-1 sm:mb-2">
							<Gift className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500 flex-shrink-0" />
							<span className="break-words">Limited Time Offer!</span>
						</h3>
						<p className="text-xs text-center sm:text-sm font-medium text-blue-700">
							Join now and get $10 worth of free credits!
						</p>
					</div>
					<div className="flex items-start gap-2">
						<Zap className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500 flex-shrink-0 mt-0.5" />
						<p className="text-xs sm:text-sm font-medium">Boost your AI power now!</p>
					</div>
					<div className="flex items-start gap-2">
						<Rocket className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500 flex-shrink-0 mt-0.5" />
						<p className="text-xs sm:text-sm font-medium">Create account for free to continue.</p>
					</div>
					<div className="bg-muted p-2 sm:p-3 rounded-lg">
						<h4 className="font-semibold mb-1 sm:mb-2 text-xs sm:text-sm">Why create an account?</h4>
						<ul className="text-xs space-y-1">
							<li>✓ $10 bonus credits</li>
							<li>✓ Zero rate limits</li>
							<li>✓ Community Prompts</li>
							<li>✓ Exclusive Features</li>
						</ul>
					</div>
				</div>
				<AlertDialogFooter className="sm:justify-start mt-2 sm:mt-0">
					<Button
						onClick={() => {
							if (uriScheme && extensionName) {
								vscode.postTrackingEvent("TrialUpsellStart")
								loginKodu({ uriScheme, extensionName })
							}
						}}
						type="submit"
						className="w-full border-none bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:from-purple-600 hover:to-blue-600 text-xs sm:text-sm py-2 h-auto">
						Get Account & $10 Bonus
					</Button>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	)
}
