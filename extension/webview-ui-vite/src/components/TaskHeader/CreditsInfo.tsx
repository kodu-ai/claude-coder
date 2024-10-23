import { useExtensionState } from '@/context/ExtensionStateContext'
import { vscode } from '@/utils/vscode'
import { VSCodeLink } from '@vscode/webview-ui-toolkit/react'
import { BadgeCheck, CreditCard, Gift, Sparkles, Users, Zap } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { getKoduAddCreditsUrl, getKoduOfferUrl, getKoduReferUrl, getKoduSignInUrl } from '../../../../src/shared/kodu'
import { formatPrice } from '../ApiOptions/utils'
import { Button } from '../ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'

interface CreditsInfoProps {
	koduCredits?: number
	vscodeUriScheme?: string
}

const CreditsInfo: React.FC<CreditsInfoProps> = ({ koduCredits, vscodeUriScheme }) => {
	const { user } = useExtensionState()
	const [isOpen, setIsOpen] = useState(false)
	useEffect(() => {
		return () => {
			console.log('cleanup')
			setIsOpen(false)
		}
	}, [])
	return (
		<div
			style={{
				backgroundColor: 'color-mix(in srgb, var(--section-border) 50%, transparent)',
				color: 'var(--vscode-activityBar-foreground)',
				borderRadius: '0 0 3px 3px',
				display: 'flex',
				justifyContent: 'space-between',
				alignItems: 'center',
				padding: '4px 12px 6px 12px',
				fontSize: '0.9em',
				marginLeft: '10px',
				marginRight: '10px',
			}}
		>
			<div style={{ fontWeight: '500' }}>Credits Remaining:</div>
			<div>
				{formatPrice(koduCredits || 0)}
				<>
					{' '}
					<Popover open={isOpen} onOpenChange={setIsOpen}>
						<PopoverTrigger asChild>
							<VSCodeLink style={{ fontSize: '0.9em' }}>(add more)</VSCodeLink>
						</PopoverTrigger>
						<PopoverContent
							avoidCollisions
							collisionPadding={8}
							// sideOffset={10}
							alignOffset={-8}
							align="center"
							// side=""
							className="p-0 !bg-transparent !border-none"
						>
							<AddCreditsContent />
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
			<CardHeader className="pb-3 text-white bg-gradient-to-r from-purple-500 to-blue-500">
				<CardTitle className="text-lg font-bold break-words sm:text-2xl">Get $10 Free Credit!</CardTitle>
				<CardDescription className="text-xs text-white/90 sm:text-sm">
					Create your Kodu.ai account now
				</CardDescription>
			</CardHeader>
			<CardContent className="pt-4 pb-2">
				<div className="mb-4 text-center">
					<Sparkles className="w-8 h-8 mx-auto mb-2 text-yellow-400 sm:h-12 sm:w-12" />
					<p className="text-sm font-semibold break-words sm:text-lg text-primary">
						Unlock AI-Powered Creativity
					</p>
				</div>
				<div className="space-y-2">
					{[
						'Access cutting-edge AI tools',
						'24/7 support from AI experts',
						'Join a thriving creator community',
					].map((text, index) => (
						<div key={index} className="flex items-start space-x-2">
							<BadgeCheck className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 flex-shrink-0 mt-0.5" />
							<p className="text-xs break-words sm:text-sm">{text}</p>
						</div>
					))}
				</div>
			</CardContent>
			<div className="p-2 sm:p-4">
				<Button
					onClick={() => {
						vscode.postMessage({
							type: 'openExternalLink',
							url: getKoduSignInUrl(uriScheme, extensionName),
						})
					}}
					className="w-full py-1 text-xs text-white border-0 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 sm:text-sm sm:py-2"
				>
					<Zap className="w-3 h-3 mr-1 sm:mr-2 sm:h-4 sm:w-4" />
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
							type: 'openExternalLink',
							url: getKoduReferUrl(),
						})
					}}
					variant="ghost"
					className="justify-start w-full h-auto p-3 text-left hover:bg-accent"
				>
					<div className="flex items-center space-x-4">
						<Users className="w-5 h-5 shrink-0" />
						<div className="flex-1 space-y-1">
							<p className="text-sm font-medium leading-none">Refer a friend</p>
							<p className="text-xs text-muted-foreground">Max 500 USD</p>
						</div>
					</div>
				</Button>
				<Button
					onClick={() => {
						vscode.postMessage({
							type: 'openExternalLink',
							url: getKoduOfferUrl(),
						})
					}}
					variant="ghost"
					className="justify-start w-full h-auto p-3 text-left hover:bg-accent"
				>
					<div className="flex items-center space-x-4">
						<Gift className="w-5 h-5 shrink-0" />
						<div className="flex-1 space-y-1">
							<p className="text-sm font-medium leading-none">Check our Offer wall</p>
							<p className="text-xs text-muted-foreground">Max 10 USD</p>
						</div>
					</div>
				</Button>
				<Button
					onClick={() => {
						vscode.postMessage({
							type: 'openExternalLink',
							url: getKoduAddCreditsUrl(),
						})
					}}
					variant="ghost"
					className="justify-start w-full h-auto p-3 text-left hover:bg-accent"
				>
					<div className="flex items-center space-x-4">
						<CreditCard className="w-5 h-5 shrink-0" />
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
