// .vscode-test.mjs is a configuration file that tells the test runner how to run the tests.
import { defineConfig } from "@vscode/test-cli"

export default defineConfig({
	files: "test/**/*.test.ts",
	mocha: {
		ui: "bdd",
		timeout: 10_000,
		// require: ["tsx/register"], // Ensure TypeScript files are loaded correctly
		require: ["tsx/cjs"],
		extension: [".ts", ".tsx"],
		"node-option": ["--loader=tsx"],
		experimentalSpecDesign: true,
	},
})
