import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [react()],
	server: {
		hmr: {
			host: "localhost",
			protocol: "ws",
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
