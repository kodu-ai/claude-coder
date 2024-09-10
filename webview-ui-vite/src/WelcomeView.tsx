import { VSCodeLink } from "@vscode/webview-ui-toolkit/react"
import React from "react"
import { getKoduSignInUrl } from "../../src/shared/kodu"
import { useExtensionState } from "./context/ExtensionStateContext"
import ApiOptions from "./components/ApiOptions/ApiOptions"
import { Balancer } from "react-wrap-balancer"
interface WelcomeViewProps {}

const WelcomeView: React.FC<WelcomeViewProps> = ({}) => {
	const { uriScheme, extensionName } = useExtensionState()

	return (
		<div
			className="text-start"
			style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, padding: "0 20px" }}>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					backgroundColor: "var(--vscode-editor-inactiveSelectionBackground)",
					color: "var(--vscode-editor-foreground)",
					padding: "6px 8px",
					borderRadius: "3px",
					margin: "8px 0px",
					fontSize: "12px",
				}}>
				<i
					className="codicon codicon-info"
					style={{
						marginRight: "6px",
						fontSize: "16px",
						color: "var(--vscode-infoIcon-foreground)",
					}}></i>
				<Balancer>
					<span>
						Explore Claude's capabilities with $10 free credits from{" "}
						<VSCodeLink href={getKoduSignInUrl(uriScheme, extensionName)} style={{ display: "inline" }}>
							Kodu.ai
						</VSCodeLink>
					</span>
				</Balancer>
			</div>
			<h2 className="text-xl font-bold mb-4">Hi, I'm Kodu Coder</h2>
			<div>
				I can do all kinds of tasks thanks to the latest breakthroughs in{" "}
				<VSCodeLink
					href="https://www-cdn.anthropic.com/fed9cc193a14b84131812372d8d5857f8f304c52/Model_Card_Claude_3_Addendum.pdf"
					style={{ display: "inline" }}>
					Claude 3.5 Sonnet's agentic coding capabilities
				</VSCodeLink>{" "}
				and access to tools that let me create & edit files, explore complex projects, and execute terminal
				commands (with your permission, of course).
			</div>

			<b>To get started, please login to your Kodu.ai Account.</b>

			<div style={{ marginTop: "4px" }}>
				<ApiOptions showModelOptions={false} />
			</div>
		</div>
	)
}

export default WelcomeView
