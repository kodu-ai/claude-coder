import React from "react"
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"

interface VSCodeButtonLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
	children: React.ReactNode
}

const VSCodeButtonLink: React.FC<VSCodeButtonLinkProps> = ({ href, children, style, ...props }) => {
	return (
		<a
			href={href}
			style={{
				textDecoration: "none",
				color: "inherit",
				...style,
			}}
			{...props}>
			<VSCodeButton>{children}</VSCodeButton>
		</a>
	)
}

export default VSCodeButtonLink
