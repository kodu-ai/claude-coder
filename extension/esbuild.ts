import esbuild, { BuildOptions } from "esbuild"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { x } from "tar"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const production = process.argv.includes("--production")
const watch = process.argv.includes("--watch")

const esbuildProblemMatcherPlugin = {
	name: "esbuild-problem-matcher",
	setup(build) {
		build.onStart(() => {
			console.log("[watch] build started")
		})
		build.onEnd((result) => {
			result.errors.forEach(({ text, location }) => {
				console.error(`✘ [ERROR] ${text}`)
				if (location) {
					console.error(`    ${location.file}:${location.line}:${location.column}:`)
				}
			})
			console.log("[watch] build finished")
		})
	},
}

function copyRecursiveSync(src: string, dest: string) {
	const entries = fs.readdirSync(src, { withFileTypes: true })
	for (const entry of entries) {
		const srcPath = path.join(src, entry.name)
		const destPath = path.join(dest, entry.name)

		if (entry.isDirectory()) {
			fs.mkdirSync(destPath, { recursive: true })
			copyRecursiveSync(srcPath, destPath)
		} else {
			fs.copyFileSync(srcPath, destPath)
		}
	}
}

// ─────────────────────────────────────────────────────────────
// 1. Plugin to copy existing assets (migrations, wasms, etc.)
// ─────────────────────────────────────────────────────────────
const copyAssetsPlugin = {
	name: "copy-assets",
	setup(build) {
		build.onEnd(() => {
			const targetDir = path.join(__dirname, "dist")
			if (!fs.existsSync(targetDir)) {
				fs.mkdirSync(targetDir, { recursive: true })
			}

			// Copy migrations
			const migrationsSrcDir = path.join(__dirname, "src", "db", "migrations")
			const migrationsDestDir = path.join(targetDir, "db", "migrations")
			fs.mkdirSync(migrationsDestDir, { recursive: true })
			copyRecursiveSync(migrationsSrcDir, migrationsDestDir)

			// Copy tree-sitter WASM files
			const treeSitterSourceDir = path.join(__dirname, "node_modules", "web-tree-sitter")
			fs.copyFileSync(
				path.join(treeSitterSourceDir, "tree-sitter.wasm"),
				path.join(targetDir, "tree-sitter.wasm")
			)

			// Copy language-specific WASM files
			const languageWasmDir = path.join(__dirname, "node_modules", "tree-sitter-wasms", "out")
			const languages = [
				"typescript",
				"tsx",
				"python",
				"rust",
				"javascript",
				"go",
				"cpp",
				"c",
				"c_sharp",
				"ruby",
				"java",
				"php",
				"swift",
			]
			languages.forEach((lang) => {
				const filename = `tree-sitter-${lang}.wasm`
				fs.copyFileSync(path.join(languageWasmDir, filename), path.join(targetDir, filename))
			})

			// Copy codicons files
			const codiconsDir = path.join(__dirname, "node_modules", "@vscode", "codicons", "dist")
			const codiconsTargetDir = path.join(targetDir, "codicons")
			if (!fs.existsSync(codiconsTargetDir)) {
				fs.mkdirSync(codiconsTargetDir, { recursive: true })
			}
			fs.copyFileSync(path.join(codiconsDir, "codicon.css"), path.join(codiconsTargetDir, "codicon.css"))
			fs.copyFileSync(path.join(codiconsDir, "codicon.ttf"), path.join(codiconsTargetDir, "codicon.ttf"))
		})
	},
}

// ─────────────────────────────────────────────────────────────
// 2. Plugin to unpack all the libsql-*.tgz archives
//    from /@libsql/* into /dist/node_modules/@libsql/*
// ─────────────────────────────────────────────────────────────
const unpackLibsqlPlugin = {
	name: "unpack-libsql",
	setup(build) {
		build.onEnd(async () => {
			const rootLibsqlDir = path.join(__dirname, "@libsql")
			if (!fs.existsSync(rootLibsqlDir)) {
				console.warn(`No @libsql folder found at ${rootLibsqlDir}, skipping unpack.`)
				return
			}
			// check if the dist/node_modules/@libsql folder exists if so we skip the unpacking
			if (fs.existsSync(path.join(__dirname, "dist", "node_modules", "@libsql"))) {
				console.warn("libsql binaries already unpacked, skipping.")
				return
			}

			const distLibsqlDir = path.join(__dirname, "dist", "node_modules", "@libsql")
			fs.mkdirSync(distLibsqlDir, { recursive: true })

			// Filter for .tgz files that start with "libsql-"
			const tgzFiles = fs
				.readdirSync(rootLibsqlDir)
				.filter((file) => file.startsWith("libsql-") && file.endsWith(".tgz"))

			for (const file of tgzFiles) {
				const srcPath = path.join(rootLibsqlDir, file)
				console.log(`Unpacking ${file} into dist/node_modules/@libsql...`)

				// Example: file = "libsql-win32-x64-msvc-0.4.7.tgz"
				// We'll parse out "win32-x64-msvc" to make a subfolder
				// Adjust this logic to suit your naming scheme
				// e.g. "libsql-darwin-x64-0.4.7.tgz" => "darwin-x64"
				const match = file.match(/^libsql-(.+?)-\d/) // capture text between "libsql-" and "-<version>"
				const platformName = match?.[1] || "unknown-platform"

				// Make a subfolder for that platform
				const targetSubfolder = path.join(distLibsqlDir, platformName)
				fs.mkdirSync(targetSubfolder, { recursive: true })

				// Extract using tar
				// If the .tgz contains a "package" folder, use strip: 1 to flatten
				await x({
					file: srcPath,
					cwd: targetSubfolder,
					strip: 1,
				})
			}

			console.log("Done unpacking libsql binaries.")
		})
	},
}

const extensionConfig: BuildOptions = {
	bundle: true,
	minify: production,
	sourcemap: !production,
	logLevel: "silent",
	plugins: [
		copyAssetsPlugin,
		//  unpackLibsqlPlugin,
		esbuildProblemMatcherPlugin,
	],
	entryPoints: ["src/extension.ts"],
	sourcesContent: false,
	keepNames: true,
	platform: "node",
	outdir: "dist",
	entryNames: "[name]",
	external: [
		"vscode",
		"chromium-bidi",
		"yazl",
		"buffer-crc32",
		// Add more if you want to fully externalize @libsql
		// e.g., "@libsql/client", "@libsql/win32-x64-msvc", etc.
		// "@libsql/win32-x64-msvc",
		// "@libsql/darwin-arm64",
		// "@libsql/darwin-x64",
		// "@libsql/linux-arm64-gnu",
		// "@libsql/linux-arm64-musl",
		// "@libsql/linux-x64-gnu",
		// "@libsql/linux-x64-musl",
	],
}

async function main() {
	const ctx = await esbuild.context(extensionConfig)
	if (watch) {
		await ctx.watch()
	} else {
		await ctx.rebuild()
		await ctx.dispose()
	}
}

main().catch((e) => {
	console.error(e)
	process.exit(1)
})
