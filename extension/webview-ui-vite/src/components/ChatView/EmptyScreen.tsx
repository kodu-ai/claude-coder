import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LayoutIcon, BarChartIcon, SmartphoneIcon, CodeIcon } from "lucide-react"

const EmptyScreen: React.FC<{
	handleClick: (value: string) => void
}> = ({ handleClick }) => {
	return (
		<div className="flex flex-col items-center justify-center bg-background text-foreground p-2 sm:p-4 my-auto">
			<Card className="w-full max-w-screen-lg">
				<CardHeader className="p-3 sm:p-4">
					<CardTitle className="text-lg sm:text-xl font-bold text-center">Quick Start Options</CardTitle>
				</CardHeader>
				<CardContent className="p-2 sm:p-4">
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
						<Button
							onClick={() => handleClick(`I want to build a landing page`)}
							className="flex flex-col sm:flex-row items-center justify-start h-auto p-3 sm:p-4 text-left"
							variant="outline">
							<LayoutIcon className="w-6 h-6 mb-2 sm:mb-0 sm:mr-3 flex-shrink-0" />
							<div className="space-y-1 w-full text-center sm:text-left">
								<div className="font-semibold text-sm sm:text-base">Let's build a landing page</div>
								<div className="text-xs sm:text-sm text-muted-foreground">
									Create an impactful first impression
								</div>
							</div>
						</Button>
						<Button
							onClick={() => handleClick(`I want to build a dashboard to visualize data`)}
							className="flex flex-col sm:flex-row items-center justify-start h-auto p-3 sm:p-4 text-left"
							variant="outline">
							<BarChartIcon className="w-6 h-6 mb-2 sm:mb-0 sm:mr-3 flex-shrink-0" />
							<div className="space-y-1 w-full text-center sm:text-left">
								<div className="font-semibold text-sm sm:text-base">Let's build a dashboard</div>
								<div className="text-xs sm:text-sm text-muted-foreground">
									Visualize data effectively
								</div>
							</div>
						</Button>
						<Button
							onClick={() => handleClick(`I want to build a mobile app using React Native`)}
							className="flex flex-col sm:flex-row items-center justify-start h-auto p-3 sm:p-4 text-left"
							variant="outline">
							<SmartphoneIcon className="w-6 h-6 mb-2 sm:mb-0 sm:mr-3 flex-shrink-0" />
							<div className="space-y-1 w-full text-center sm:text-left">
								<div className="font-semibold text-sm sm:text-base">
									Let's build a mobile application
								</div>
								<div className="text-xs sm:text-sm text-muted-foreground">
									Develop for iOS and Android
								</div>
							</div>
						</Button>
						<Button
							onClick={() => handleClick(`I want to build ...`)}
							className="flex flex-col sm:flex-row items-center justify-start h-auto p-3 sm:p-4 text-left"
							variant="outline">
							<CodeIcon className="w-6 h-6 mb-2 sm:mb-0 sm:mr-3 flex-shrink-0" />
							<div className="space-y-1 w-full text-center sm:text-left">
								<div className="font-semibold text-sm sm:text-base">Custom project</div>
								<div className="text-xs sm:text-sm text-muted-foreground">Start with your own idea</div>
							</div>
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	)
}

export default EmptyScreen
