import React from "react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { DiscordLogoIcon, GitHubLogoIcon, StarIcon } from "@radix-ui/react-icons"
import { useExtensionState } from "@/context/ExtensionStateContext"

export const SettingsFooter = () => {
	const { version, user } = useExtensionState()
	return (
		<div className="mt-8 pt-4 border-t border-border flex flex-wrap w-full flex-1">
			<div className="flex flex-col space-y-2">
				<div className="flex items-center flex-wrap gap-2 max-w-[90vw] overflow-hidden justify-between text-xs text-muted-foreground">
					<span>Version: {version}</span>
					{user?.id && <span className="truncate inline">User ID: {user.id}</span>}
				</div>
				<div className="flex flex-wrap  items-center gap-2">
					<div className="flex space-x-2">
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<Button variant="outline" size="icon" asChild>
										<a
											href="https://github.com/kodu-ai/claude-coder"
											target="_blank"
											rel="noopener noreferrer">
											<GitHubLogoIcon className="h-4 w-4" />
										</a>
									</Button>
								</TooltipTrigger>
								<TooltipContent>
									<p>View on GitHub</p>
								</TooltipContent>
							</Tooltip>
						</TooltipProvider>
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<Button variant="outline" size="icon" asChild>
										<a
											href="https://discord.gg/Fn97SD34qk"
											target="_blank"
											rel="noopener noreferrer">
											<DiscordLogoIcon className="h-4 w-4" />
										</a>
									</Button>
								</TooltipTrigger>
								<TooltipContent>
									<p>Join our Discord</p>
								</TooltipContent>
							</Tooltip>
						</TooltipProvider>
					</div>
					<Button variant="outline" size="sm" className="flex-grow max-w-fit" asChild>
						<a href="https://github.com/kodu-ai/claude-coder" target="_blank" rel="noopener noreferrer">
							<StarIcon className="h-4 w-4 mr-2" />
							Star us on GitHub
						</a>
					</Button>
				</div>
			</div>
		</div>
	)
}
