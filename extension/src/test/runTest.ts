// src/test/runTest.ts

import * as path from "path"
import * as os from "os"
import { runTests } from "@vscode/test-electron"

async function main() {
	try {
		const extensionDevelopmentPath = path.resolve(__dirname, "../../../../")
		const extensionTestsPath = path.resolve(__dirname, "./suite/index")

		const testWorkspace = path.resolve(__dirname, "../../../../")
		const firstArg = process.argv[2]

		let params = {
			extensionDevelopmentPath,
			extensionTestsPath,
			launchArgs: [firstArg ?? testWorkspace],
		} as any

		if (os.platform() === "linux") {
			params["vscodeExecutablePath"] = "/app/VSCode-linux-arm64/bin/code"
		}

		await runTests(params)
	} catch (err) {
		console.error("Failed to run tests")
		process.exit(1)
	}
}

main()
