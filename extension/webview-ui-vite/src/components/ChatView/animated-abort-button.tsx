import React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

const AnimatedAbortButton: React.FC<{
	isInTask: boolean
	isRequestRunning: boolean
	isAborting: boolean
	onAbort: () => void
}> = ({ isInTask, isRequestRunning, isAborting, onAbort }) => {
	return (
		<AnimatePresence>
			{isInTask && isRequestRunning && (
				<motion.div
					className="fixed bottom-24 left-4 z-50"
					initial={{ opacity: 0, y: 15 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0, y: 15 }}
					transition={{ duration: 0.4 }}>
					<Button
						onClick={onAbort}
						disabled={!isRequestRunning || isAborting}
						size="sm"
						variant="destructive"
						className="w-fit">
						{isAborting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
						Abort Request
					</Button>
				</motion.div>
			)}
		</AnimatePresence>
	)
}

export default AnimatedAbortButton
