import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { LayoutIcon, BarChartIcon, SmartphoneIcon, CodeIcon } from "lucide-react"

const EmptyScreen: React.FC<{
	handleClick: (value: string) => void
}> = ({ handleClick }) => {
	return (
		<div className="flex flex-col items-center justify-center bg-background text-foreground p-4 my-auto">
			<Card>
				<CardHeader>
					<CardTitle className="text-xl font-bold">Quick Start Options</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<Button
							onClick={() => handleClick(`I want to build a landing page`)}
							className="flex items-center justify-start space-x-2 h-20"
							variant="outline">
							<LayoutIcon className="w-6 h-6" />
							<div className="text-left">
								<div className="font-semibold">Let's build a landing page</div>
								<div className="text-sm text-muted-foreground">
									Create an impactful first impression
								</div>
							</div>
						</Button>
						<Button
							onClick={() => handleClick(`I want to build a dashboard to visualize data`)}
							className="flex items-center justify-start space-x-2 h-20"
							variant="outline">
							<BarChartIcon className="w-6 h-6" />
							<div className="text-left">
								<div className="font-semibold">Let's build a dashboard</div>
								<div className="text-sm text-muted-foreground">Visualize data effectively</div>
							</div>
						</Button>
						<Button
							onClick={() => handleClick(`I want to build a mobile app using React Native`)}
							className="flex items-center justify-start space-x-2 h-20"
							variant="outline">
							<SmartphoneIcon className="w-6 h-6" />
							<div className="text-left">
								<div className="font-semibold">Let's build a mobile application</div>
								<div className="text-sm text-muted-foreground">Develop for iOS and Android</div>
							</div>
						</Button>
						<Button
							onClick={() => handleClick(`I want to build ...`)}
							className="flex items-center justify-start space-x-2 h-20"
							variant="outline">
							<CodeIcon className="w-6 h-6" />
							<div className="text-left">
								<div className="font-semibold">Custom project</div>
								<div className="text-sm text-muted-foreground">Start with your own idea</div>
							</div>
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	)
}

export default EmptyScreen
