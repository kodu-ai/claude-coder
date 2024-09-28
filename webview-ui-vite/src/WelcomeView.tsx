import React from "react"
import { VSCodeButton, VSCodeLink } from "@vscode/webview-ui-toolkit/react"
import { Info, Zap, LogIn, Loader2 } from "lucide-react"
import { Balancer } from "react-wrap-balancer"
import { useExtensionState } from "./context/ExtensionStateContext"
import { loginKodu } from "./utils/kodu-links"
import { useVisitorData } from "@fingerprintjs/fingerprintjs-pro-react"
import { vscode } from "./utils/vscode"
import { useTrialTrackingContext } from "./context/TrialTrackingContext"

interface WelcomeViewProps { }

const WelcomeView: React.FC<WelcomeViewProps> = ({ }) => {
	const { uriScheme, extensionName, fingerprint } = useExtensionState()
	const { getData } = useVisitorData()
	const [isLoading, setIsLoading] = React.useState(false)

	const { trackOfferView } = useTrialTrackingContext()

	React.useEffect(() => {
		trackOfferView()
	}, [])


	return (
		<div className="text-[var(--vscode-editor-foreground)] p-4 sm:p-6 flex flex-col items-center">
			<div className="max-w-xl w-full space-y-6">
				{/* Info Banner */}
				<div className="bg-[var(--vscode-notifications-background)] p-3 rounded flex items-center space-x-2 text-xs">
					<Info className="text-[var(--vscode-notificationsInfoIcon-foreground)] flex-shrink-0 w-4 h-4" />
					<div>
						Explore Claude's capabilities with <span className="font-semibold">$10 free credits</span> from{" "}
						<VSCodeLink
							onClick={() => {
								if (uriScheme && extensionName) loginKodu({ uriScheme, extensionName })
							}}
							href="#"
							className="text-[var(--vscode-textLink-foreground)]">
							Kodu.ai
						</VSCodeLink>
					</div>
				</div>

				{/* Main Content */}
				<div className="text-start space-y-2">
					<h1 className="text-2xl sm:text-3xl font-bold">
						<Balancer>Welcome to Kodu Coder</Balancer>
					</h1>
					{/* <Balancer> */}
					<div className="text-sm sm:text-base">
						Powered by{" "}
						<VSCodeLink
							href="https://www-cdn.anthropic.com/fed9cc193a14b84131812372d8d5857f8f304c52/Model_Card_Claude_3_Addendum.pdf"
							className="text-[var(--vscode-textLink-foreground)]">
							Claude 3.5 Sonnet's advanced AI capabilities
						</VSCodeLink>{" "}
						assisting you with a wide range of coding tasks.
					</div>
					{/* </Balancer> */}
				</div>

				{/* CTA Sections */}
				<div className="grid sm:grid-cols-2 gap-4">
					{/* Sign Up Section */}
					<div className="bg-[var(--vscode-editor-background)] flex flex-col p-4 rounded space-y-3 order-2 sm:order-none">
						<h2 className="text-lg font-semibold flex items-center">
							<LogIn className="mr-2 w-5 h-5" /> Sign In for Full Access
						</h2>
						<p className="text-sm">
							<Balancer preferNative={false} ratio={0.4}>
								Unlock the full potential of Kodu Coder with high rate limits and latest features.
							</Balancer>
						</p>
						<VSCodeButton
							onClick={() => {
								if (uriScheme && extensionName) loginKodu({ uriScheme, extensionName })
							}}
							className="w-36"
							appearance="primary">
							{/* Sign up to Kodu */}
							Continue with Kodu
						</VSCodeButton>
						<div className="text-xs text-[var(--vscode-descriptionForeground)]">
							<VSCodeLink href="https://kodu.ai" className="text-[var(--vscode-textLink-foreground)]">
								Learn more about Kodu here.
							</VSCodeLink>
						</div>
					</div>

					{/* Free Trial Section */}
					<div className="bg-[var(--vscode-editor-background)] flex flex-col p-4 rounded space-y-3">
						<h2 className="text-lg font-semibold flex items-center">
							<Zap className="mr-2 w-5 h-5 text-[var(--vscode-terminal-ansiYellow)]" /> Try for Free
						</h2>
						<p className="text-sm">
							<Balancer preferNative={false} ratio={0.4}>
								Get started with 1 USD worth of credits no sign-up required!
							</Balancer>
						</p>
						<VSCodeButton
							disabled={isLoading}
							onClick={async () => {
								setIsLoading(true)
								if (fingerprint) {
									vscode.postMessage({ type: "freeTrial", fp: fingerprint })
									setTimeout(() => {
										setIsLoading(false)
									}, 5000)
									return
								}
								const data = await { getData }.getData()
								if (data?.visitorId) {
									console.log(`NO FP: ${data.visitorId}`)
									vscode.postMessage({ type: "freeTrial", fp: data.visitorId })
								}
								setTimeout(() => {
									setIsLoading(false)
								}, 1000)
							}}
							className="w-36 flex items-center"
							appearance="primary">
							<div className="flex items-center">
								<Loader2 className={`w-4 h-4 animate-spin mr-2 ${isLoading ? "block" : "hidden"}`} />
								<span>Start Free Trial</span>
							</div>
						</VSCodeButton>
					</div>
				</div>
			</div>
		</div>
	)
}

export default WelcomeView
