import React from "react"
import { getKoduSignInUrl } from "../../../../src/shared/kodu"
import { vscode } from "../../utils/vscode"
import { useExtensionState } from "../../context/ExtensionStateContext"
import { PromoContainer, PromoLink, CloseButton } from "./styles"

interface KoduPromoProps {
	style?: React.CSSProperties
}

const KoduPromo: React.FC<KoduPromoProps> = ({ style }) => {
	const { uriScheme, extensionName } = useExtensionState()

	const handleClose = () => {
		vscode.postMessage({ type: "didDismissKoduPromo" })
	}

	return (
		<PromoContainer style={style}>
			<PromoLink href={getKoduSignInUrl(uriScheme, extensionName)}>
				<i className="codicon codicon-info" />
				<span>Claim $10 free credits from Kodu</span>
			</PromoLink>
			<CloseButton onClick={handleClose}>
				<i className="codicon codicon-close" />
			</CloseButton>
		</PromoContainer>
	)
}

export default KoduPromo
