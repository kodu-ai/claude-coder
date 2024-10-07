import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { FileCode } from 'lucide-react'

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

export default function ProjectStarterChooser({ onSelect }: { onSelect: (template: string) => void }) {
	const [searchValue, setSearchValue] = useState('')

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

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="outline" className="flex-1 bg-gray-700 text-white border-gray-600 hover:bg-gray-600">
					<FileCode className="mr-2 h-4 w-4" />
					Start from template
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="w-[300px] bg-gray-800 border-gray-700">
				<div className="p-2">
					<Input
						placeholder="Search project starters..."
						value={searchValue}
						onChange={(e) => setSearchValue(e.target.value)}
						className="bg-gray-700 text-white border-gray-600"
					/>
				</div>
				<ScrollArea className="h-[300px]">
					{isLoading ? (
						<DropdownMenuItem disabled>Loading...</DropdownMenuItem>
					) : error ? (
						<DropdownMenuItem disabled>Error loading starters. Please try again.</DropdownMenuItem>
					) : filteredProjects.length === 0 ? (
						<DropdownMenuItem disabled>No results found.</DropdownMenuItem>
					) : (
						filteredProjects.map((project) => (
							<DropdownMenuItem
								key={project.repo}
								className="flex flex-col items-start p-2 hover:bg-gray-700 focus:bg-gray-700"
								onSelect={() => onSelect(project.repo)}
							>
								<div className="flex justify-between items-center w-full">
									<span className="font-medium text-white">{project.title}</span>
									{project.isOfficial && (
										<span className="text-xs bg-purple-600 text-white px-1 rounded">Official</span>
									)}
								</div>
								<span className="text-xs text-gray-400">{project.creator}</span>
								<p className="text-xs text-gray-400 mt-1 line-clamp-2">{project.description}</p>
							</DropdownMenuItem>
						))
					)}
				</ScrollArea>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}
