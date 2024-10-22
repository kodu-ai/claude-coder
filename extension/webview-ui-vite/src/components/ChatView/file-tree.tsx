import { Alert, AlertDescription } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { useVirtualizer } from '@tanstack/react-virtual'
import { motion } from 'framer-motion'
import { ChevronRight, File, Folder, Search } from 'lucide-react'
import React, { useState, useCallback, useRef, type KeyboardEvent, useMemo } from 'react'

export type FileNode = {
	id: string
	name: string
	type: 'file' | 'folder'
	children?: FileNode[]
	depth: number
	matchReason?: 'direct' | 'childMatch'
}

type EnhancedFileTreeProps = {
	initialFiles: FileNode[]
	onItemSelect: (value: Set<string>) => void
	value: Set<string>
}

const MAX_SELECTED_ITEMS = 50

export default function EnhancedFileTree({ initialFiles, onItemSelect, value }: EnhancedFileTreeProps) {
	const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
	const [filter, setFilter] = useState('')
	const [showMaxError, setShowMaxError] = useState(false)

	const toggleFolder = (id: string) => {
		setExpandedFolders((prev) => {
			const next = new Set(prev)
			if (next.has(id)) {
				next.delete(id)
			} else {
				next.add(id)
			}
			return next
		})
	}

	const getFirstDepthChildren = (node: FileNode): string[] => {
		if (node.type !== 'folder' || !node.children) {
			return []
		}
		return node.children.filter((child) => child.type === 'file').map((child) => child.id)
	}

	const toggleSelect = (id: string, node: FileNode) => {
		const newSelectedItems = new Set(value)
		const firstDepthChildren = getFirstDepthChildren(node)

		if (node.type === 'folder') {
			const allChildrenSelected = firstDepthChildren.every((childId) => newSelectedItems.has(childId))
			if (allChildrenSelected) {
				// Unselect all children
				firstDepthChildren.forEach((childId) => newSelectedItems.delete(childId))
			} else {
				// Select all children
				if (newSelectedItems.size + firstDepthChildren.length <= MAX_SELECTED_ITEMS) {
					firstDepthChildren.forEach((childId) => newSelectedItems.add(childId))
				} else {
					setShowMaxError(true)
					return
				}
			}
		} else {
			// Toggle selection for files
			if (newSelectedItems.has(id)) {
				newSelectedItems.delete(id)
			} else if (newSelectedItems.size < MAX_SELECTED_ITEMS) {
				newSelectedItems.add(id)
			} else {
				setShowMaxError(true)
				return
			}
		}

		setShowMaxError(false)
		onItemSelect(newSelectedItems)
	}

	const filterFiles = useCallback(
		(node: FileNode): FileNode | null => {
			const matchesFilter = node.name.toLowerCase().includes(filter.toLowerCase())
			if (matchesFilter) {
				return { ...node, matchReason: 'direct' }
			}
			if (node.type === 'folder' && node.children) {
				const filteredChildren = node.children
					.map(filterFiles)
					.filter((child): child is FileNode => child !== null)
				if (filteredChildren.length > 0) {
					return { ...node, children: filteredChildren, matchReason: 'childMatch' }
				}
			}
			return null
		},
		[filter],
	)

	const filteredFiles = useMemo(() => {
		const filtered = initialFiles.map(filterFiles).filter((file): file is FileNode => file !== null)
		return filtered
	}, [initialFiles, filterFiles])

	const flattenFileTree = useCallback(
		(nodes: FileNode[]): FileNode[] => {
			return nodes.reduce<FileNode[]>((acc, node) => {
				acc.push(node)
				if (
					node.type === 'folder' &&
					node.children &&
					(expandedFolders.has(node.id) || node.matchReason === 'childMatch')
				) {
					acc.push(...flattenFileTree(node.children))
				}
				return acc
			}, [])
		},
		[expandedFolders],
	)

	const flattenedFiles = useMemo(() => flattenFileTree(filteredFiles), [filteredFiles, flattenFileTree])

	const parentRef = useRef<HTMLDivElement>(null)

	const virtualizer = useVirtualizer({
		count: flattenedFiles.length,
		getScrollElement: () => parentRef.current,
		estimateSize: () => 35,
		overscan: 5,
	})

	const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>, node: FileNode) => {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault()
			toggleSelect(node.id, node)
		}
	}

	const FileTreeItem = useCallback(
		({ node }: { node: FileNode }) => {
			const isExpanded = expandedFolders.has(node.id)
			const isSelected = value.has(node.id)
			const firstDepthChildren = getFirstDepthChildren(node)
			const areAllChildrenSelected =
				firstDepthChildren.length > 0 && firstDepthChildren.every((childId) => value.has(childId))

			return (
				<div
					className={`flex items-center space-x-2 py-1 px-2 hover:bg-accent hover:text-accent-foreground cursor-pointer ${
						isSelected || (node.type === 'folder' && areAllChildrenSelected)
							? 'bg-primary text-primary-foreground'
							: ''
					} ${node.matchReason === 'childMatch' ? 'opacity-70' : ''}`}
					style={{ paddingLeft: `${node.depth * 1.5 + 0.5}rem` }}
					onClick={() => node.type === 'folder' && toggleFolder(node.id)}
					onKeyDown={(e) => handleKeyDown(e, node)}
					tabIndex={0}
					role="button"
					aria-pressed={isSelected || areAllChildrenSelected}
				>
					<Checkbox
						id={`checkbox-${node.id}`}
						checked={isSelected || (node.type === 'folder' && areAllChildrenSelected)}
						onCheckedChange={() => toggleSelect(node.id, node)}
						onClick={(e) => e.stopPropagation()}
					/>
					{node.type === 'folder' && (
						<div className="w-4 h-4 flex items-center justify-center">
							<motion.div
								initial={false}
								animate={{ rotate: isExpanded ? 90 : 0 }}
								transition={{ duration: 0.2 }}
							>
								<ChevronRight className="w-4 h-4" />
							</motion.div>
						</div>
					)}
					{node.type === 'folder' ? (
						<Folder className="w-4 h-4 text-primary" />
					) : (
						<File className="w-4 h-4" />
					)}
					<span>{node.name}</span>
				</div>
			)
		},
		[expandedFolders, value, toggleFolder, toggleSelect],
	)

	return (
		<div className="w-full max-w-md mx-auto p-4 bg-background text-foreground rounded-lg shadow">
			<div className="mb-4 relative">
				<Input
					type="text"
					placeholder="Filter files and folders..."
					value={filter}
					onChange={(e) => setFilter(e.target.value)}
					className="pl-10"
				/>
				<Search className="w-5 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
			</div>
			{showMaxError && (
				<Alert variant="destructive" className="mb-4">
					<AlertDescription>
						Maximum selection limit reached. You can select up to {MAX_SELECTED_ITEMS} items.
					</AlertDescription>
				</Alert>
			)}
			<div ref={parentRef} className="border border-border rounded overflow-auto h-[400px]">
				<div
					style={{
						height: `${virtualizer.getTotalSize()}px`,
						width: '100%',
						position: 'relative',
					}}
				>
					{virtualizer.getVirtualItems().map((virtualItem) => (
						<div
							key={virtualItem.key}
							data-index={virtualItem.index}
							ref={virtualizer.measureElement}
							style={{
								position: 'absolute',
								top: 0,
								left: 0,
								width: '100%',
								transform: `translateY(${virtualItem.start}px)`,
							}}
						>
							<FileTreeItem node={flattenedFiles[virtualItem.index]} />
						</div>
					))}
				</div>
			</div>
		</div>
	)
}
