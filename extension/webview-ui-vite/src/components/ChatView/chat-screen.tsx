import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { LayoutIcon, BarChartIcon, SmartphoneIcon, CodeIcon, History, ArrowLeft, Rocket } from "lucide-react"
import { useState, useEffect, useCallback } from "react"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Monitor, LayoutDashboard, Smartphone, Briefcase, RefreshCcw, Lightbulb } from "lucide-react"
import { BorderBeam } from "../ui/border-beam"

type ProjectType = "landingPage" | "dashboard" | "mobileApp" | "customProject"

interface ProjectDialogProps {
	isOpen: boolean
	onClose: () => void
	sendMessage: (text: string) => void
	projectType: ProjectType
	onPreFill: (text: string) => void
}

const taskPrompts = {
	landingPage: [
		"Create a landing page for a sustainable clothing brand. Use a clean, minimalist design with a nature-inspired color palette. Include a hero section with a carousel of product images. Add a 'Our Impact' section with some simple animations to highlight key sustainability metrics.",
		"Design a landing page for a virtual cooking class platform. Implement a warm, inviting color scheme. Feature a grid layout of popular classes with hover effects. Include a simple booking form and a FAQ section with expandable questions.",
		"Develop a landing page for a productivity app. Use a modern, professional design with a blue and white color scheme. Create a features section with icons and brief descriptions. Add a testimonial slider and a simple pricing table.",
		"Build a landing page for an online bookstore. Use a cozy, book-inspired design with serif fonts. Include a search bar in the hero section and a grid of featured books. Add a newsletter signup form with basic form validation.",
	],
	dashboard: [
		"Create a personal finance dashboard. Include charts for income vs. expenses, savings goals, and budget categories. Use a clean, professional design with a calming color palette. Add a transactions list with sorting and basic filtering options.",
		"Design a social media analytics dashboard. Display key metrics like follower growth, engagement rates, and post performance. Use a modern, flat design style. Include a content calendar and a simple sentiment analysis chart.",
		"Develop a fitness tracking dashboard. Show progress charts for weight, workout frequency, and personal records. Use a motivating color scheme. Include a workout log and a basic meal planning section.",
		"Build a project management dashboard. Display project timelines, task completion rates, and team workload. Use a clean, minimal design. Include a kanban board for task management and a team member list.",
	],
	mobileApp: [
		"Design a recipe sharing app. Include features like recipe upload, categorization, and search. Use a clean, food-inspired interface. Add a grocery list generator and a basic meal planning calendar.",
		"Create a habit tracking app. Implement daily habit check-ins, streaks, and progress visualizations. Use a motivational design with achievement unlocks. Include reminder notifications and a simple statistics page.",
		"Develop a language learning app focused on vocabulary. Include flashcard exercises, multiple-choice quizzes, and progress tracking. Use a friendly, education-themed design. Add a word-of-the-day feature and basic speech recognition for pronunciation practice.",
		"Build a personal journal app with mood tracking. Include text entries, mood selection, and basic media uploads. Use a calm, minimalist design. Add a calendar view and simple mood trend visualizations.",
	],
	customProject: [
		"Create a web-based code editor with real-time collaboration features. Implement syntax highlighting, basic autocompletion, and live code sharing. Use a developer-friendly dark mode design. Include a chat system and simple version control.",
		"Develop a digital asset management system for small businesses. Include file uploading, tagging, and basic search functionality. Use a clean, organized interface. Add user roles and permissions and a simple workflow approval process.",
		"Build a task automation tool using a visual programming interface. Implement drag-and-drop components for creating automation flows. Use an intuitive, flowchart-style design. Include pre-built templates and a basic debugging feature.",
		"Design a virtual book club platform. Include features for book discussions, reading progress tracking, and meeting scheduling. Use a cozy, literary-inspired interface. Add a quote sharing system and simple book recommendation engine.",
	],
}

export function ProjectDialog({ isOpen, onClose, projectType, onPreFill, sendMessage }: ProjectDialogProps) {
	const [input, setInput] = useState("")
	const [placeholder, setPlaceholder] = useState("")
	const [isTyping, setIsTyping] = useState(true)
	const [currentPromptIndex, setCurrentPromptIndex] = useState(0)

	const getIcon = (type: ProjectType) => {
		switch (type) {
			case "landingPage":
				return <Monitor className="w-6 h-6" />
			case "dashboard":
				return <LayoutDashboard className="w-6 h-6" />
			case "mobileApp":
				return <Smartphone className="w-6 h-6" />
			case "customProject":
				return <Briefcase className="w-6 h-6" />
		}
	}

	const getColor = (type: ProjectType) => {
		switch (type) {
			case "landingPage":
				return "bg-blue-500"
			case "dashboard":
				return "bg-green-500"
			case "mobileApp":
				return "bg-purple-500"
			case "customProject":
				return "bg-yellow-500"
		}
	}

	const cyclePlaceholder = useCallback(() => {
		if (input.length > 1) {
			setInput("")
		}
		// setCurrentPromptIndex((prevIndex) => (prevIndex + 1) % taskPrompts[projectType].length)
		// cycle from start to finish to start again
		setCurrentPromptIndex((prevIndex) => (taskPrompts[projectType].length - 1 === prevIndex ? 0 : prevIndex + 1))
	}, [projectType, input])

	useEffect(() => {
		if (isOpen) {
			setPlaceholder("")
			setIsTyping(true)
			const fullPlaceholder = taskPrompts[projectType][currentPromptIndex]
			let i = 0
			const typingInterval = setInterval(() => {
				if (i < fullPlaceholder.length) {
					setPlaceholder((prev) => prev + fullPlaceholder.charAt(i))
					i++
				} else {
					clearInterval(typingInterval)
					setIsTyping(false)
				}
			}, 50)
			return () => clearInterval(typingInterval)
		}
	}, [isOpen, projectType, currentPromptIndex])

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault()
		console.log(`Submitted for ${projectType}:`, input)
		sendMessage(input)
		setInput("")
		onClose()
	}

	const handlePreFill = () => {
		const textToFill = taskPrompts[projectType][currentPromptIndex]
		setInput(textToFill)
		onPreFill(textToFill)
	}

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className="sm:max-w-[500px] max-w-[90vw]">
				<AnimatePresence>
					{isOpen && (
						<motion.div
							initial={{ opacity: 0, scale: 0.9 }}
							animate={{ opacity: 1, scale: 1 }}
							exit={{ opacity: 0, scale: 0.9 }}
							transition={{ duration: 0.2 }}>
							<DialogHeader>
								<DialogTitle className="text-2xl font-bold flex items-center gap-2">
									<span className={`p-2 rounded-full text-primary`}>{getIcon(projectType)}</span>
									What's on your mind ?
								</DialogTitle>
							</DialogHeader>
							<form onSubmit={handleSubmit} className="mt-4 space-y-4 w-full">
								<div className="relative rounded-md h-[160px] bg-muted overflow-hidden">
									<BorderBeam borderWidth={2} size={250} />
									<textarea
										value={input}
										onChange={(e) => setInput(e.target.value)}
										className="w-full h-full p-2 rounded-md focus:outline-none resize-none bg-muted text-foreground"
										aria-label={`Share your thoughts about your ${projectType}`}
									/>
									{input === "" && (
										<div
											className="absolute top-2 left-2 text-foreground/80 pointer-events-none"
											aria-hidden="true">
											{placeholder}
											{isTyping && (
												<motion.span
													initial={{ opacity: 0 }}
													animate={{ opacity: [0, 1, 0] }}
													transition={{ repeat: Infinity, duration: 0.8 }}>
													|
												</motion.span>
											)}
										</div>
									)}
								</div>
								<div className="flex justify-center items-center flex-wrap gap-4 max-[500px]:flex-col max-[500px]:items-stretch max-[500px]:content-center">
									<Button
										type="button"
										onClick={cyclePlaceholder}
										className="max-w-[200px] flex items-center gap-2"
										variant="outline">
										<RefreshCcw className="w-4 h-4" />
										Cycle Prompt
									</Button>
									<Button
										type="button"
										onClick={handlePreFill}
										className="max-w-[200px] flex items-center gap-2"
										variant="outline">
										<Lightbulb className="w-4 h-4" />
										Use Prompt
									</Button>
									<Button type="submit" className="max-w-[200px]">
										<Rocket className="w-4 h-4 mr-2" />
										GO
									</Button>
								</div>
							</form>
						</motion.div>
					)}
				</AnimatePresence>
			</DialogContent>
		</Dialog>
	)
}

const ChatScreen: React.FC<{
	handleClick: (value: string) => void
	taskHistory: React.ReactNode
}> = ({ handleClick, taskHistory }) => {
	const [showHistory, setShowHistory] = useState(true)
	const [greeting, setGreeting] = useState("")
	const [showProjectDialog, setShowProjectDialog] = useState(false)
	const [projectType, setProjectType] = useState<ProjectType | null>(null)

	useEffect(() => {
		const updateGreeting = () => {
			const hour = new Date().getHours()
			if (hour >= 5 && hour < 12) setGreeting("Good morning")
			else if (hour >= 12 && hour < 18) setGreeting("Good afternoon")
			else if (hour >= 18 && hour < 22) setGreeting("Good evening")
			else setGreeting("Happy late night")
		}

		updateGreeting()
		const interval = setInterval(updateGreeting, 60000)
		return () => clearInterval(interval)
	}, [])

	const selectStartOption = (type: ProjectType) => {
		setProjectType(type)
		setShowProjectDialog(true)
	}

	const quickStartOptions = [
		{
			icon: LayoutIcon,
			title: "Let's build a landing page",
			description: "Create an impactful first impression",
			onClick: () => selectStartOption("landingPage"),
		},
		{
			icon: BarChartIcon,
			title: "Let's build a dashboard",
			description: "Visualize data effectively",
			onClick: () => selectStartOption("dashboard"),
		},
		{
			icon: SmartphoneIcon,
			title: "Let's build a mobile application",
			description: "Develop for iOS and Android",
			onClick: () => selectStartOption("mobileApp"),
		},
		{
			icon: CodeIcon,
			title: "Custom project",
			description: "Start with your own idea",
			onClick: () => selectStartOption("customProject"),
		},
		{
			icon: History,
			title: "View previous tasks",
			description: "Resume a previous task",
			onClick: () => setShowHistory(true),
		},
	]

	const containerVariants = {
		hidden: { opacity: 0 },
		visible: {
			opacity: 1,
			transition: {
				when: "beforeChildren",
				staggerChildren: 0.1,
			},
		},
		exit: { opacity: 0, transition: { duration: 0.2 } },
	}

	const itemVariants = {
		hidden: { opacity: 0, y: 20 },
		visible: { opacity: 1, y: 0 },
		hover: { scale: 1.05, transition: { duration: 0.2 } },
	}

	return (
		<>
			{/* <ProjectDialog
				isOpen={showProjectDialog}
				sendMessage={handleClick}
				onClose={() => setShowProjectDialog(false)}
				projectType={projectType ?? "landingPage"}
				onPreFill={(text) => console.log("Pre-filled text:", text)}
			/> */}
			<div className="flex flex-col items-center justify-start pb-0 mb-0 p-2 sm:p-4 relative h-full overflow-hidden">
				<Card className="w-full max-w-screen-lg border-0 border-unset bg-transparent flex-grow overflow-auto">
					<CardHeader>
						<CardTitle className="text-2xl sm:text-3xl md:text-4xl font-bold text-center">
							<motion.div
								initial={{ opacity: 0, y: -20 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ duration: 0.5 }}
								className="bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 text-transparent bg-clip-text">
								{greeting}
							</motion.div>
							<AnimatePresence mode="wait">
								<motion.div
									key={showHistory ? "history" : "build"}
									initial={{ opacity: 0, y: 20 }}
									animate={{ opacity: 1, y: 0 }}
									exit={{ opacity: 0, y: -20 }}
									transition={{ duration: 0.3 }}
									className="mt-2 text-xl sm:text-2xl md:text-3xl">
									{showHistory ? "Your previous tasks" : "What should we build today?"}
								</motion.div>
							</AnimatePresence>
						</CardTitle>
					</CardHeader>
					<CardContent className="p-2 sm:p-4">
						<AnimatePresence mode="wait">
							<motion.div
								key={showHistory ? "history" : "quickstart"}
								variants={containerVariants}
								initial="hidden"
								animate="visible"
								exit="exit"
								className={showHistory ? "" : "grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 "}>
								{showHistory
									? taskHistory
									: quickStartOptions.map((option, index) => (
											<motion.div key={index} variants={itemVariants} whileHover="hover">
												<Button
													onClick={option.onClick}
													className="w-full flex flex-col sm:flex-row items-center justify-start h-auto p-3 sm:p-4 text-left"
													variant="outline">
													<option.icon className="w-6 h-6 mb-2 sm:mb-0 sm:mr-3 flex-shrink-0" />
													<div className="space-y-1 w-full text-center sm:text-left">
														<div className="font-semibold text-sm sm:text-base">
															{option.title}
														</div>
														<div className="text-xs sm:text-sm text-muted-foreground">
															{option.description}
														</div>
													</div>
												</Button>
											</motion.div>
									  ))}
							</motion.div>
						</AnimatePresence>
					</CardContent>
				</Card>
			</div>
		</>
	)
}

export default ChatScreen
