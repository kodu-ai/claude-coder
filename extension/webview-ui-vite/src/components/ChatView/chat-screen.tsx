import React, { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { LayoutIcon, BarChartIcon, SmartphoneIcon, CodeIcon, History, ArrowLeft } from "lucide-react"

const taskPrompts = {
	landingPage: [
		"Create a landing page for a sustainable clothing brand. Use a clean, minimalist design with a nature-inspired color palette. Include a hero section with a carousel of product images. Add a 'Our Impact' section with some simple animations to highlight key sustainability metrics.",
		"Design a landing page for a virtual cooking class platform. Implement a warm, inviting color scheme. Feature a grid layout of popular classes with hover effects. Include a simple booking form and a FAQ section with expandable questions.",
		"Develop a landing page for a productivity app. Use a modern, professional design with a blue and white color scheme. Create a features section with icons and brief descriptions. Add a testimonial slider and a simple pricing table.",
		"Build a landing page for an online bookstore. Use a cozy, book-inspired design with serif fonts. Include a search bar in the hero section and a grid of featured books. Add a newsletter signup form with basic form validation.",
		"Create a landing page for a fitness tracking app. Use an energetic design with a dark mode option. Include animated illustrations of key features. Add a 'Success Stories' section with before/after comparisons and a simple BMI calculator.",
		"Design a landing page for a travel blogging platform. Use a clean layout with large, high-quality images. Implement a world map with clickable points for featured destinations. Include a grid of recent blog posts with hover effects.",
		"Develop a landing page for a podcast hosting service. Use a modern, audio-inspired design. Include an embedded audio player for a sample podcast. Create a features comparison table and a simple signup form.",
		"Build a landing page for a local farmer's market. Use a rustic, organic design style. Include a seasonal produce calendar with hover effects. Add a vendor spotlight section and a simple location map.",
	],
	dashboard: [
		"Create a personal finance dashboard. Include charts for income vs. expenses, savings goals, and budget categories. Use a clean, professional design with a calming color palette. Add a transactions list with sorting and basic filtering options.",
		"Design a social media analytics dashboard. Display key metrics like follower growth, engagement rates, and post performance. Use a modern, flat design style. Include a content calendar and a simple sentiment analysis chart.",
		"Develop a fitness tracking dashboard. Show progress charts for weight, workout frequency, and personal records. Use a motivating color scheme. Include a workout log and a basic meal planning section.",
		"Build a project management dashboard. Display project timelines, task completion rates, and team workload. Use a clean, minimal design. Include a kanban board for task management and a team member list.",
		"Create a e-commerce sales dashboard. Show revenue trends, top-selling products, and customer demographics. Use a professional, data-focused design. Include a sales funnel visualization and a simple inventory status table.",
		"Design a weather monitoring dashboard. Display current conditions, forecasts, and historical data. Use a sky-inspired color palette. Include an interactive map with basic weather layers and a severe weather alert section.",
		"Develop a learning management system dashboard. Show course progress, upcoming deadlines, and grade distributions. Use an education-themed design. Include a calendar view and a simple quiz creation tool.",
		"Build a smart home control dashboard. Display energy usage, temperature controls, and security status. Use a modern, IoT-inspired design. Include toggle switches for smart devices and a basic automation rules creator.",
	],
	mobileApp: [
		"Design a recipe sharing app. Include features like recipe upload, categorization, and search. Use a clean, food-inspired interface. Add a grocery list generator and a basic meal planning calendar.",
		"Create a habit tracking app. Implement daily habit check-ins, streaks, and progress visualizations. Use a motivational design with achievement unlocks. Include reminder notifications and a simple statistics page.",
		"Develop a language learning app focused on vocabulary. Include flashcard exercises, multiple-choice quizzes, and progress tracking. Use a friendly, education-themed design. Add a word-of-the-day feature and basic speech recognition for pronunciation practice.",
		"Build a personal journal app with mood tracking. Include text entries, mood selection, and basic media uploads. Use a calm, minimalist design. Add a calendar view and simple mood trend visualizations.",
		"Design a meditation and mindfulness app. Include guided meditation sessions, breathing exercises, and streak tracking. Use a serene, nature-inspired interface. Add ambient sound options and a simple meditation timer.",
		"Create a local event discovery app. Implement event listings, categories, and a map view. Use a modern, location-aware design. Include a favorites system and basic event reminders.",
		"Develop a budget tracking app. Include expense logging, budget setting, and spending visualizations. Use a clean, finance-themed interface. Add bill reminders and a simple saving goals feature.",
		"Build a plant care app. Include plant identification, care instructions, and watering reminders. Use a green, nature-inspired design. Add a basic disease diagnosis tool and a plant growth tracking feature.",
	],
	customProject: [
		"Create a web-based code editor with real-time collaboration features. Implement syntax highlighting, basic autocompletion, and live code sharing. Use a developer-friendly dark mode design. Include a chat system and simple version control.",
		"Develop a digital asset management system for small businesses. Include file uploading, tagging, and basic search functionality. Use a clean, organized interface. Add user roles and permissions and a simple workflow approval process.",
		"Build a task automation tool using a visual programming interface. Implement drag-and-drop components for creating automation flows. Use an intuitive, flowchart-style design. Include pre-built templates and a basic debugging feature.",
		"Design a virtual book club platform. Include features for book discussions, reading progress tracking, and meeting scheduling. Use a cozy, literary-inspired interface. Add a quote sharing system and simple book recommendation engine.",
		"Create a personal knowledge management system. Implement note-taking, linking between notes, and basic visualization of connections. Use a clean, minimalist design. Include tags, search functionality, and a simple spaced repetition system for review.",
		"Develop a crowdfunding platform for local community projects. Include project creation, donation processing, and progress tracking. Use a community-oriented design. Add social sharing features and a simple updates/comments system.",
		"Build a freelance job marketplace focused on creative professionals. Implement job postings, user profiles, and a basic messaging system. Use a modern, portfolio-style design. Include a simple escrow payment system and job completion tracking.",
		"Design a goal-setting and accountability app. Include goal creation, milestone tracking, and progress visualizations. Use a motivational, achievement-oriented interface. Add an accountability partner system and simple habit tracking integration.",
	],
}
const getRandomPrompt = (category: keyof typeof taskPrompts) => {
	const prompts = taskPrompts[category]
	return prompts[Math.floor(Math.random() * prompts.length)]
}

const ChatScreen: React.FC<{
	handleClick: (value: string) => void
	taskHistory: React.ReactNode
}> = ({ handleClick, taskHistory }) => {
	const [showHistory, setShowHistory] = useState(false)
	const [greeting, setGreeting] = useState("")

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

	const quickStartOptions = [
		{
			icon: LayoutIcon,
			title: "Let's build a landing page",
			description: "Create an impactful first impression",
			onClick: () => handleClick(getRandomPrompt("landingPage")),
		},
		{
			icon: BarChartIcon,
			title: "Let's build a dashboard",
			description: "Visualize data effectively",
			onClick: () => handleClick(getRandomPrompt("dashboard")),
		},
		{
			icon: SmartphoneIcon,
			title: "Let's build a mobile application",
			description: "Develop for iOS and Android",
			onClick: () => handleClick(getRandomPrompt("mobileApp")),
		},
		{
			icon: CodeIcon,
			title: "Custom project",
			description: "Start with your own idea",
			onClick: () => handleClick(getRandomPrompt("customProject")),
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
		<div className="flex flex-col items-center justify-start h-[calc(100%_-_24px)] p-2 sm:p-4 mb-auto mt-2 relative">
			<Card className="w-full max-w-screen-lg border-0 border-unset bg-transparent">
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
							className={showHistory ? "" : "grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4"}>
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
			<AnimatePresence>
				{showHistory && (
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: 20 }}
						transition={{ duration: 0.3 }}
						className="absolute bottom-2 right-4">
						<Button
							onClick={() => setShowHistory(false)}
							variant="outline"
							size="sm"
							className="w-fit flex items-center justify-center">
							<ArrowLeft className="w-4 h-4 mr-2" /> Back
						</Button>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	)
}

export default ChatScreen
