import { useState, useEffect, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { vscode } from "@/utils/vscode"
import { Virtuoso } from "react-virtuoso"
import Fuse, { FuseResult } from "fuse.js"
import HistoryItem from "./HistoryItem"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip"
import { type HistoryItem as HistoryItemT } from "../../../../src/shared/HistoryItem"
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTrigger,
} from "../ui/dialog"

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
	const { taskHistory } = useExtensionState()
	const [searchQuery, setSearchQuery] = useState("")
	const [sortOption, setSortOption] = useState<SortOption>("newest")
	const [lastNonRelevantSort, setLastNonRelevantSort] = useState<SortOption | null>("newest")

	useEffect(() => {
		if (searchQuery && sortOption !== "mostRelevant" && !lastNonRelevantSort) {
			setLastNonRelevantSort(sortOption)
			setSortOption("mostRelevant")
		} else if (!searchQuery && sortOption === "mostRelevant" && lastNonRelevantSort) {
			setSortOption(lastNonRelevantSort)
			setLastNonRelevantSort(null)
		}
	}, [searchQuery, sortOption, lastNonRelevantSort])

	const presentableTasks = useMemo(() => {
		return taskHistory.filter((item) => item.ts && item.task)
	}, [taskHistory])

	const fuse = useMemo(() => {
		return new Fuse(presentableTasks, {
			keys: ["task", "name"],
			threshold: 0.7,
			shouldSort: true,
			isCaseSensitive: false,
			ignoreLocation: false,
			includeMatches: true,
			minMatchCharLength: 1,
		})
	}, [presentableTasks])

	const taskHistorySearchResults = useMemo(() => {
		const results = searchQuery ? highlight(fuse.search(searchQuery)) : presentableTasks

		results.sort((a, b) => {
			switch (sortOption) {
				case "oldest":
					return a.ts - b.ts
				case "mostExpensive":
					return (b.totalCost || 0) - (a.totalCost || 0)
				case "mostTokens":
					return (
						(b.tokensIn || 0) +
						(b.tokensOut || 0) +
						(b.cacheWrites || 0) +
						(b.cacheReads || 0) -
						((a.tokensIn || 0) + (a.tokensOut || 0) + (a.cacheWrites || 0) + (a.cacheReads || 0))
					)
				case "mostRelevant":
					return searchQuery ? 0 : b.ts - a.ts
				case "newest":
				default:
					return b.ts - a.ts
			}
		})

		return results
	}, [presentableTasks, searchQuery, fuse, sortOption])

	return (
		<div className="fixed inset-0 flex flex-col overflow-hidden">
			<div className="flex justify-between items-center p-4 pb-0">
				<h3 className="text-lg font-semibold">History</h3>
				<div className="flex flex-wrap gap-2">
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
									<Button size="sm" variant="outline">
										Cancel
									</Button>
								</DialogClose>
								<DialogClose asChild>
									<Button
										size="sm"
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
