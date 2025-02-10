import { useState, useEffect, useMemo, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { useExtensionState } from "@/context/extension-state-context"
import { vscode } from "@/utils/vscode"
import { Virtuoso } from "react-virtuoso"
import Fuse, { FuseResult } from "fuse.js"
import HistoryItem from "./history-item"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip"
import { type HistoryItem as HistoryItemT } from "extension/shared/history-item"
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTrigger,
} from "../ui/dialog"
import { ArchiveRestore } from "lucide-react"
import { rpcClient } from "@/lib/rpc-client"
type SortOption = "newest" | "oldest" | "mostExpensive" | "mostTokens" | "mostRelevant"

type HistoryViewProps = {
	onDone: () => void
}

const highlight = (
	fuseSearchResult: FuseResult<HistoryItemT>[],
	highlightClassName: string = "history-item-highlight"
) => {
	const set = (obj: Record<string, any>, path: string, value: any) => {
		const pathValue = path.split(".")
		let i: number

		for (i = 0; i < pathValue.length - 1; i++) {
			obj = obj[pathValue[i]] as Record<string, any>
		}

		obj[pathValue[i]] = value
	}

	const generateHighlightedText = (inputText: string, regions: [number, number][] = []) => {
		let content = ""
		let nextUnhighlightedRegionStartingIndex = 0

		regions.forEach((region) => {
			const lastRegionNextIndex = region[1] + 1

			content += [
				inputText.substring(nextUnhighlightedRegionStartingIndex, region[0]),
				`<span class="text-primary">`,
				inputText.substring(region[0], lastRegionNextIndex),
				"</span>",
			].join("")

			nextUnhighlightedRegionStartingIndex = lastRegionNextIndex
		})

		content += inputText.substring(nextUnhighlightedRegionStartingIndex)

		return content
	}

	return fuseSearchResult
		.filter(({ matches }) => matches && matches.length)
		.map(({ item, matches }) => {
			const highlightedItem = { ...item }

			matches?.forEach((match) => {
				if (match.key && typeof match.value === "string") {
					set(highlightedItem, match.key, generateHighlightedText(match.value, [...match.indices]))
				}
			})

			return highlightedItem
		})
}

const HistoryView = ({ onDone }: HistoryViewProps) => {
	// Create a typed client *only using the type* AppRouter
	const { taskHistory } = useExtensionState()
	const [searchQuery, setSearchQuery] = useState("")
	const [debouncedQuery, setDebouncedQuery] = useState("")

	// Debounce search input
	useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedQuery(searchQuery)
		}, 100) // 100ms debounce

		return () => clearTimeout(timer)
	}, [searchQuery])
	const [sortOption, setSortOption] = useState<SortOption>("newest")
	const [lastNonRelevantSort, setLastNonRelevantSort] = useState<SortOption | null>("newest")
	const { mutate: restoreTaskFromDisk } = rpcClient.restoreTaskFromDisk.useMutation({})

	useEffect(() => {
		if (debouncedQuery && sortOption !== "mostRelevant" && !lastNonRelevantSort) {
			setLastNonRelevantSort(sortOption)
			setSortOption("mostRelevant")
		} else if (!debouncedQuery && sortOption === "mostRelevant" && lastNonRelevantSort) {
			setSortOption(lastNonRelevantSort)
			setLastNonRelevantSort(null)
		}
	}, [debouncedQuery, sortOption, lastNonRelevantSort])

	const presentableTasks = useMemo(() => {
		return taskHistory.filter((item) => item.ts && item.task)
	}, [taskHistory])

	const fuse = useMemo(() => {
		// Pre-process tasks to create searchable text
		const processedTasks = presentableTasks.map((task) => ({
			...task,
			searchText: `${task.task} ${task.name || ""}`.toLowerCase(),
		}))

		return new Fuse(processedTasks, {
			keys: ["searchText"],
			threshold: 0.3,
			shouldSort: false,
			isCaseSensitive: false,
			ignoreLocation: true,
			includeMatches: true,
			minMatchCharLength: 2,
			distance: 20, // Reduced distance for better performance
		})
	}, [presentableTasks])

	const taskHistorySearchResults = useMemo(() => {
		const trimmedQuery = debouncedQuery.trim().toLowerCase()
		let results: HistoryItemT[] = []

		if (trimmedQuery) {
			// Quick exact match check first
			const exactMatches = presentableTasks.filter(
				(task) =>
					task.task.toLowerCase().includes(trimmedQuery) ||
					(task.name && task.name.toLowerCase().includes(trimmedQuery))
			)

			if (exactMatches.length > 0) {
				results = exactMatches
			} else {
				// Fall back to fuzzy search with limit
				const searchResults = fuse.search(trimmedQuery).slice(0, 50) // Limit results after search
				results = highlight(searchResults)
			}

			// Apply relevance sorting if needed
			if (sortOption === "mostRelevant") {
				results.sort((a, b) => {
					// Prioritize exact matches in task or name
					const aTaskMatch = a.task.toLowerCase().includes(trimmedQuery)
					const bTaskMatch = b.task.toLowerCase().includes(trimmedQuery)
					const aNameMatch = (a.name || "").toLowerCase().includes(trimmedQuery)
					const bNameMatch = (b.name || "").toLowerCase().includes(trimmedQuery)

					if (aTaskMatch !== bTaskMatch) return aTaskMatch ? -1 : 1
					if (aNameMatch !== bNameMatch) return aNameMatch ? -1 : 1

					// Then by timestamp for equal matches
					return (b.ts ?? 0) - (a.ts ?? 0)
				})
			}
		} else {
			results = [...presentableTasks]
		}

		// Apply standard sorting if not using relevance or no search query
		if (sortOption !== "mostRelevant" || !trimmedQuery) {
			results.sort((a, b) => {
				switch (sortOption) {
					case "oldest":
						return a.ts - b.ts
					case "mostExpensive":
						return (b.totalCost ?? 0) - (a.totalCost ?? 0)
					case "mostTokens": {
						const getTokenCount = (item: HistoryItemT) =>
							(item.tokensIn ?? 0) +
							(item.tokensOut ?? 0) +
							(item.cacheWrites ?? 0) +
							(item.cacheReads ?? 0)
						return getTokenCount(b) - getTokenCount(a)
					}
					case "newest":
					default:
						return b.ts - a.ts
				}
			})
		}

		return results
	}, [presentableTasks, debouncedQuery, fuse, sortOption])

	return (
		<div className="fixed inset-0 flex flex-col overflow-hidden">
			<div className="flex justify-between items-center p-4 pb-0">
				<h3 className="text-lg font-semibold">History</h3>
				<div className="flex flex-wrap gap-2">
					<Button
						onClick={async () => {
							const res = await restoreTaskFromDisk({})
							// console.log(`pauseTask response: ${JSON.stringify(res)}`)
						}}
						size="sm"
						variant="ghost">
						<ArchiveRestore className="w-4 h-4" />
					</Button>
					<Dialog>
						<DialogTrigger asChild>
							<Button size="sm" variant="destructive">
								Clear History
							</Button>
						</DialogTrigger>
						<DialogContent>
							<DialogHeader className="pt-2">Are you sure you want to clear your history?</DialogHeader>
							<DialogDescription>
								This action cannot be undone. All history will be permanently deleted
							</DialogDescription>
							<DialogFooter className="gap-2">
								<DialogClose asChild>
									<Button variant="outline">Cancel</Button>
								</DialogClose>
								<DialogClose asChild>
									<Button
										variant="destructive"
										onClick={() => vscode.postMessage({ type: "clearHistory" })}>
										Delete All
									</Button>
								</DialogClose>
							</DialogFooter>
						</DialogContent>
					</Dialog>
					<Button size="sm" onClick={onDone}>
						Done
					</Button>
				</div>
			</div>
			<div className="p-4">
				<div className="flex flex-col gap-4">
					<Input
						className="w-full"
						placeholder="Name or task content"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
					/>
					<RadioGroup
						className="flex flex-wrap gap-2"
						value={sortOption}
						onValueChange={(value) => setSortOption(value as SortOption)}>
						<div className="flex items-center space-x-2">
							<RadioGroupItem value="newest" id="newest" />
							<Label htmlFor="newest">Newest</Label>
						</div>
						<div className="flex items-center space-x-2">
							<RadioGroupItem value="oldest" id="oldest" />
							<Label htmlFor="oldest">Oldest</Label>
						</div>
						<div className="flex items-center space-x-2">
							<RadioGroupItem value="mostExpensive" id="mostExpensive" />
							<Label htmlFor="mostExpensive">Most Expensive</Label>
						</div>
						<div className="flex items-center space-x-2">
							<RadioGroupItem value="mostTokens" id="mostTokens" />
							<Label htmlFor="mostTokens">Most Tokens</Label>
						</div>
						<Tooltip>
							<TooltipTrigger asChild>
								<div className="flex items-center space-x-2">
									<RadioGroupItem value="mostRelevant" id="mostRelevant" disabled={!searchQuery} />
									<Label htmlFor="mostRelevant" className={!searchQuery ? "opacity-50" : ""}>
										Most Relevant
									</Label>
								</div>
							</TooltipTrigger>
							<TooltipContent align="center" collisionPadding={8} side="bottom">
								<span className="text-wrap block max-w-[75vw]">
									Sort by relevance when searching (requires a search query)
								</span>
							</TooltipContent>
						</Tooltip>
					</RadioGroup>
				</div>
			</div>
			<div className="flex-grow overflow-y-auto">
				<Virtuoso
					className="h-full"
					data={taskHistorySearchResults}
					itemContent={(index, item) => (
						<HistoryItem
							key={item.id}
							item={item}
							onSelect={() => vscode.postMessage({ type: "showTaskWithId", text: item.id })}
							onDelete={() => vscode.postMessage({ type: "deleteTaskWithId", text: item.id })}
							onExport={() => vscode.postMessage({ type: "exportTaskWithId", text: item.id })}
						/>
					)}
				/>
			</div>
		</div>
	)
}

export default HistoryView
