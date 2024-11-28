import esbuild, { BuildOptions } from "esbuild"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

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
				console.error(`    ${location.file}:${location.line}:${location.column}:`)
			})
			console.log("[watch] build finished")
		})
	},
}

const copyAssetsPlugin = {
	name: "copy-assets",
	setup(build) {
		build.onEnd(() => {
			// Create dist directory if it doesn't exist
			const targetDir = path.join(__dirname, "dist")
			if (!fs.existsSync(targetDir)) {
				fs.mkdirSync(targetDir, { recursive: true })
			}

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
			const codiconsTargetDir = path.join(targetDir, "node_modules", "@vscode", "codicons", "dist")

			if (!fs.existsSync(codiconsTargetDir)) {
				fs.mkdirSync(codiconsTargetDir, { recursive: true })
			}

			// Copy codicon.css and codicon.ttf
			fs.copyFileSync(path.join(codiconsDir, "codicon.css"), path.join(codiconsTargetDir, "codicon.css"))
			fs.copyFileSync(path.join(codiconsDir, "codicon.ttf"), path.join(codiconsTargetDir, "codicon.ttf"))
		})
	},
}

const extensionConfig = {
	bundle: true,
	minify: production,
	sourcemap: !production,
	logLevel: "silent",
	plugins: [copyAssetsPlugin, esbuildProblemMatcherPlugin],
	entryPoints: ["src/extension.ts"],
	format: "cjs",
	sourcesContent: false,
	keepNames: true,
	platform: "node",
	outfile: "dist/extension.js",
	external: ["vscode", "chromium-bidi"],
} satisfies BuildOptions

async function main() {
	const extensionCtx = await esbuild.context(extensionConfig)
	if (watch) {
		await extensionCtx.watch()
	} else {
		await extensionCtx.rebuild()
		await extensionCtx.dispose()
	}
}

main().catch((e) => {
	console.error(e)
	process.exit(1)
})
