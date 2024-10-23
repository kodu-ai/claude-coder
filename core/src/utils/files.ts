import * as path from "path"

/**
 * Format a list of files for display
 * @param absolutePath - The absolute path of the directory
 * @param files - Array of file paths
 * @returns Formatted string of file list
 */
export function formatFilesList(absolutePath: string, files: string[], didHitLimit: boolean): string {
	const sorted = files
		.map((file) => {
			// convert absolute path to relative path
			const relativePath = path.relative(absolutePath, file).toPosix()
			return file.endsWith("/") ? relativePath + "/" : relativePath
		})
		// Sort so files are listed under their respective directories to make it clear what files are children of what directories. Since we build file list top down, even if file list is truncated it will show directories that cline can then explore further.
		.sort((a, b) => {
			const aParts = a.split("/") // only works if we use toPosix first
			const bParts = b.split("/")
			for (let i = 0; i < Math.min(aParts.length, bParts.length); i++) {
				if (aParts[i] !== bParts[i]) {
					// If one is a directory and the other isn't at this level, sort the directory first
					if (i + 1 === aParts.length && i + 1 < bParts.length) {
						return -1
					}
					if (i + 1 === bParts.length && i + 1 < aParts.length) {
						return 1
					}
					// Otherwise, sort alphabetically
					return aParts[i].localeCompare(bParts[i], undefined, { numeric: true, sensitivity: "base" })
				}
			}
			// If all parts are the same up to the length of the shorter path,
			// the shorter one comes first
			return aParts.length - bParts.length
		})
	if (didHitLimit) {
		return `${sorted.join(
			"\n"
		)}\n\n(File list truncated. Use list_files on specific subdirectories if you need to explore further.)`
	} else if (sorted.length === 0 || (sorted.length === 1 && sorted[0] === "")) {
		return "No files found."
	} else {
		return sorted.join("\n")
	}
}
