import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { vscode } from '@/utils/vscode'
import { MagicWandIcon } from '@radix-ui/react-icons'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Rocket, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '../ui/alert-dialog'
import { FormDescription } from '../ui/form'
import { Input } from '../ui/input'
import { Label } from '../ui/label'

interface Starter {
	title: string
	description: string
	repo: string
	creator: string
	isOfficial: boolean
}

const fetchStarters = async (): Promise<Starter[]> => {
	const response = await fetch('https://raw.githubusercontent.com/kodu-ai/starters/main/starters.json')
	if (!response.ok) {
		throw new Error('Network response was not ok')
	}
	return response.json()
}

export default function ProjectStarterChooser() {
	const [open, setOpen] = useState(false)
	const [searchValue, setSearchValue] = useState('')
	const [selectedStarter, setSelectedStarter] = useState<Starter | null>(null)
	const [projectName, setProjectName] = useState('')

	const {
		data: starters,
		isLoading,
		error,
	} = useQuery<Starter[]>({
		queryKey: ['starters'],
		queryFn: fetchStarters,
	})

	const filteredProjects =
		starters?.filter(
			(project) =>
				project.title?.toLowerCase().includes(searchValue?.toLowerCase()) ||
				project.description?.toLowerCase().includes(searchValue?.toLowerCase()) ||
				project.creator?.toLowerCase().includes(searchValue?.toLowerCase()),
		) || []
	const handleStarterClick = (starter: Starter) => {
		setSelectedStarter(starter)
	}

	const handleBootstrap = () => {
		// Implement the bootstrapping logic here
		console.log(`Bootstrapping ${selectedStarter?.title}`)
		vscode.postMessage({
			type: 'quickstart',
			repo: selectedStarter?.repo,
			name: projectName,
		})
		setSelectedStarter(null)
	}

	const isValidProjectName = projectName.trim().length > 2

	useEffect(() => {
		return () => {
			setSelectedStarter(null)
			setProjectName('')
			setSearchValue('')
		}
	}, [])

	return (
		<>
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger asChild>
					<Button variant="outline" className="justify-between w-fit mt-2 ml-4">
						<MagicWandIcon className="h-4 w-4 text-primary mr-2" />
						Quick Start
					</Button>
				</PopoverTrigger>
				<PopoverContent
					className="max-w-[280px] w-[90vw] p-0 !bg-transparent !border-none overflow-y-hidden"
					avoidCollisions={true}
					collisionPadding={8}
					align="center"
				>
					<Command className="rounded-lg border shadow-md">
						<CommandInput
							placeholder="Search project starters..."
							value={searchValue}
							onValueChange={setSearchValue}
						/>
						<CommandList className="overflow-hidden">
							<CommandEmpty>No results found.</CommandEmpty>
							<CommandGroup>
								<ScrollArea className="h-[300px]">
									{isLoading ? (
										<div className="flex items-center justify-center h-full">
											<Loader2 className="h-6 w-6 animate-spin text-primary" />
										</div>
									) : error ? (
										<div className="text-center text-sm text-muted-foreground p-4">
											Error loading starters. Please try again.
										</div>
									) : (
										<div className="grid grid-cols-1 gap-2 p-2">
											{filteredProjects.map((project) => (
												<CommandItem
													key={project.repo}
													className="p-0 rounded-lg cursor-pointer"
													onSelect={() => handleStarterClick(project)}
												>
													<Card className="w-full overflow-hidden transition-all rounded-lg hover:bg-accent hover:text-accent-foreground">
														<CardHeader className="p-3">
															<div className="flex justify-between items-start">
																<CardTitle className="text-sm font-medium leading-tight">
																	{project.title}
																</CardTitle>
																{project.isOfficial && (
																	<Badge
																		variant="default"
																		className="bg-primary text-primary-foreground"
																	>
																		Official
																	</Badge>
																)}
															</div>
															<CardDescription className="text-xs">
																{project.creator}
															</CardDescription>
														</CardHeader>
														<CardContent className="p-3 pt-0">
															<p className="text-xs text-muted-foreground line-clamp-2">
																{project.description}
															</p>
														</CardContent>
													</Card>
												</CommandItem>
											))}
										</div>
									)}
								</ScrollArea>
							</CommandGroup>
						</CommandList>
					</Command>
				</PopoverContent>
			</Popover>

			<AlertDialog
				open={!!selectedStarter}
				onOpenChange={() => {
					setSelectedStarter(null)
					setProjectName('')
					setSearchValue('')
				}}
			>
				<AlertDialogContent className="max-w-[320px] w-[90vw]">
					<AlertDialogHeader>
						<AlertDialogTitle>Quickstart Project</AlertDialogTitle>
						<AlertDialogDescription className="text-start">
							Do you want to bootstrap <span className="font-semibold">{selectedStarter?.title}</span>?
							give your project a name and click Launch.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<div className="grid w-full max-w-sm items-center gap-1.5">
						<Label htmlFor="name">Project Name</Label>
						<Input
							value={projectName}
							onChange={(e) => setProjectName(e.target.value)}
							type="name"
							id="name"
							placeholder="Project Name"
						/>
						{projectName.length === 0 || projectName.trim().length >= 3 ? null : (
							<span className="text-xs text-red-500">Project name is too short</span>
						)}
					</div>
					<AlertDialogFooter>
						<AlertDialogCancel>
							<X className="h-4 w-4 mr-2" />
							Cancel
						</AlertDialogCancel>
						<AlertDialogAction disabled={!isValidProjectName} onClick={handleBootstrap}>
							<Rocket className="h-4 w-4 mr-2" />
							Launch
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	)
}
