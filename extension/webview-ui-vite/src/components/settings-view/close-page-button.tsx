import React from "react"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"
import { useSetAtom } from "jotai"
import { showSettingsAtom } from "../../context/extension-state-context"

const ClosePageButton: React.FC = () => {
	const setIsOpen = useSetAtom(showSettingsAtom)
	return (
		<Button variant="ghost" size="icon" className="ml-auto" onClick={() => setIsOpen(false)}>
			<X className="size-4" />
		</Button>
	)
}

export default ClosePageButton
