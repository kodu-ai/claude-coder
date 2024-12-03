// .vscode-test.mjs is a configuration file that tells the test runner how to run the tests.
import { defineConfig } from "@vscode/test-cli"

export default defineConfig({
	files: "test/**/*.test.ts",
	mocha: {
		ui: "bdd",
		timeout: 20000,
		require: ["tsx/cjs"],
		diff: true,
		extension: [".ts", ".tsx"],
		"node-option": ["--loader=tsx"],
	},
})
