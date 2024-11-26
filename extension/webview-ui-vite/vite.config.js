import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import path from "path"
// https://vitejs.dev/config/
export default defineConfig({
	plugins: [react()],
	server: {
		hmr: {
			host: "localhost",
			protocol: "ws",
		},
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
	build: {
		outDir: "build",
		sourcemap: false,
		// Exclude VSCode webview resources from bundle
		rollupOptions: {
			external: ["vscode-webview"],
			output: {
				entryFileNames: `assets/[name].js`,
				chunkFileNames: `assets/[name].js`,
				assetFileNames: `assets/[name].[ext]`,
			},
		},
	},
})
