"use client"

import React from "react"
import { motion } from "framer-motion"
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Users, Gift, CreditCard, Zap, Coins, TrendingUp } from "lucide-react"
import { useExtensionState } from "@/context/extension-state-context"
import { atom, useAtom, useSetAtom } from "jotai"
import { vscode } from "@/utils/vscode"
import { getKoduAddCreditsUrl, getKoduOfferUrl, getKoduReferUrl } from "../../../../src/shared/kodu"

const isOpenAtom = atom(false)

export const useOutOfCreditDialog = () => {
	const { user } = useExtensionState()
	const setIsOpen = useSetAtom(isOpenAtom)
	return {
		openOutOfCreditDialog: () => user?.credits && user.credits < 0.1 && setIsOpen(true),
		shouldOpenOutOfCreditDialog: user?.credits && user.credits < 0.1,
	}
}

export default function OutOfCreditDialog() {
	const [isOpen, setIsOpen] = useAtom(isOpenAtom)
	return (
		<Dialog open={isOpen} onOpenChange={setIsOpen}>
			<DialogContent className="w-[90vw] max-w-[450px] p-0 rounded-lg">
				<div className="bg-gradient-to-r from-purple-600 to-blue-600 p-4 text-white ">
					<DialogHeader className="">
						<DialogTitle className="text-2xl font-bold flex items-center gap-2">
							<Zap className="h-6 w-6 text-yellow-300" />
							<span>Oops! You're out of credit</span>
						</DialogTitle>
						<DialogDescription className="text-white/90 mt-2">
							Don't let your AI journey end here. Recharge now and keep the magic going!
						</DialogDescription>
					</DialogHeader>
				</div>

				<div className="p-4">
					<h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
						<Coins className="h-5 w-5 text-yellow-500" />
						<span>Choose how to power up:</span>
					</h3>

					<div className="space-y-3">
						<CreditOption
							icon={<Users className="h-5 w-5 text-green-500" />}
							title="Refer a friend"
							description="Earn up to $500 in credits"
							onClick={() => {
								vscode.postMessage({
									type: "openExternalLink",
									url: getKoduReferUrl(),
								})
								setIsOpen(false)
							}}
						/>
						<CreditOption
							icon={<Gift className="h-5 w-5 text-purple-500" />}
							title="Check our Offer wall"
							description="Get up to $10 in free credits"
							onClick={() => {
								vscode.postMessage({
									type: "openExternalLink",
									url: getKoduOfferUrl(),
								})
								setIsOpen(false)
							}}
						/>
						<CreditOption
							icon={<CreditCard className="h-5 w-5 text-blue-500" />}
							title="Buy Credits"
							description="Instant top-up, start from $5"
							onClick={() => {
								vscode.postMessage({
									type: "openExternalLink",
									url: getKoduAddCreditsUrl(),
								})
								setIsOpen(false)
							}}
						/>
					</div>

					<div className="mt-6 bg-muted p-4 rounded-lg">
						<h4 className="font-semibold mb-2 flex items-center gap-2">
							<TrendingUp className="h-4 w-4" />
							<span>Why add more credits?</span>
						</h4>
						<ul className="text-sm space-y-1 text-foreground">
							<li>✓ Unlimited AI-powered assistance</li>
							<li>✓ Access to premium features</li>
							<li>✓ Faster response times</li>
							<li>✓ Support for longer conversations</li>
						</ul>
					</div>
				</div>

				<DialogFooter className="p-4">
					<Button
						onClick={() => {
							vscode.postMessage({
								type: "openExternalLink",
								url: getKoduAddCreditsUrl(),
							})
							setIsOpen(false)
						}}
						className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 transition-all duration-300">
						Add Credits Now
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}

const CreditOption: React.FC<{
	icon: React.ReactNode
	title: string
	description: string
	onClick: () => void
}> = ({ icon, title, description, onClick }) => {
	return (
		<motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
			<Card className="overflow-hidden transition-all duration-300 hover:shadow-md" onClick={onClick}>
				<CardContent className="p-4 flex items-center space-x-4 cursor-pointer">
					<div className="shrink-0">{icon}</div>
					<div>
						<p className="font-medium">{title}</p>
						<p className="text-sm text-foreground/80">{description}</p>
					</div>
				</CardContent>
			</Card>
		</motion.div>
	)
}
