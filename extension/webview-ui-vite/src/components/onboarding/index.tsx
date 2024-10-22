'use client'

import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { useExtensionState } from '@/context/ExtensionStateContext'
import { vscode } from '@/utils/vscode'
import { AnimatePresence, motion } from 'framer-motion'
import { Brain, Code, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'

type CodingLevel = 'no-technical' | 'technical' | 'developer'

export const technicalLevels = {
	'no-technical': {
		icon: Sparkles,
		title: 'Non Technical',
		description: "Don't have many ideas about coding or how technology works",
		explanation: 'This will give Kodu a complete freedom to choose the technology stack and tools.',
		color: 'from-purple-500 to-pink-500',
	},
	technical: {
		icon: Code,
		title: 'Coding Beginner',
		description: "Technical, but don't know how to code or just learning how to code",
		explanation:
			'This will give Kodu a complete freedom to choose the technology stack and tools unless you explicitly say which tools you want to use.',
		color: 'from-blue-500 to-teal-500',
	},
	developer: {
		icon: Brain,
		title: 'Experienced Developer',
		description: 'Have enough experience to call myself a software developer',
		explanation:
			'Kodu will trust your intuition, and will expect you to understand the code to some extent, and give you complete freedom to choose technology stack and tooling.',
		color: 'from-orange-500 to-red-500',
	},
}

export default function OnboardingDialog() {
	const { setTechnicalBackground, technicalBackground } = useExtensionState()
	const open = !technicalBackground
	const [selectedLevel, setSelectedLevel] = useState<typeof technicalBackground>('no-technical')
	const [progress, setProgress] = useState(0)

	useEffect(() => {
		const timer = setTimeout(() => setProgress(66), 300)
		return () => clearTimeout(timer)
	}, [])

	const handleSubmit = () => {
		if (selectedLevel) {
			setProgress(100)
			setTimeout(() => {
				console.log(`User selected level: ${selectedLevel}`)
				vscode.postMessage({ type: 'technicalBackground', value: selectedLevel })
			}, 100)
		}
	}

	const handleCardClick = (level: CodingLevel) => {
		setSelectedLevel(level)
	}

	return (
		<Dialog
			open={open}
			onOpenChange={(e) => {
				if (!e) {
					setTechnicalBackground(selectedLevel ?? 'no-technical')
				}
			}}
		>
			<DialogContent className="sm:max-w-[425px] overflow-hidden">
				<DialogHeader>
					<DialogTitle className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">
						Welcome to Kodu.ai!
					</DialogTitle>
					<DialogDescription>
						Let's personalize your coding journey. What's your current level?
					</DialogDescription>
				</DialogHeader>
				<Progress value={progress} className="w-full mt-2" />
				<div className="py-6">
					<AnimatePresence>
						{Object.entries(technicalLevels).map(([level, info]) => (
							<motion.div
								key={level}
								initial={{ opacity: 0, y: 20 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -20 }}
								transition={{ duration: 0.3 }}
								className="mb-4"
							>
								<div
									onClick={() => handleCardClick(level as CodingLevel)}
									className={`flex shadow-sm items-start space-x-2 p-4 rounded-lg transition-all duration-300 cursor-pointer
                    ${
						selectedLevel === level
							? `bg-gradient-to-r ${info.color} text-white`
							: 'bg-card text-foreground'
					}`}
								>
									<div className="flex-shrink-0 mt-1">
										<div
											className={`w-4 h-4 rounded-full border-2 ${
												selectedLevel === level ? 'border-white bg-white' : 'border-foreground'
											}`}
										/>
									</div>
									<div className="grid gap-1.5 leading-none">
										<Label className="text-lg font-semibold flex items-center gap-2">
											<info.icon className="w-5 h-5" />
											{info.title}
										</Label>
										<p className="text-sm">{info.description}</p>
										<p className="text-xs mt-2 opacity-80">{info.explanation}</p>
									</div>
								</div>
							</motion.div>
						))}
					</AnimatePresence>
				</div>
				<DialogFooter className="sticky bottom-0">
					<Button
						onClick={handleSubmit}
						// disabled={!selectedLevel}
						className={`w-full transition-all duration-300 border-0 border-none ${
							selectedLevel
								? 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700'
								: ''
						}`}
					>
						{selectedLevel ? 'Start my awesome journey!' : 'Choose your level'}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
