// src/test/runTest.ts

import * as path from "path"
import { runTests } from "@vscode/test-electron"
import * as cp from "child_process"

async function main() {
	try {
		const extensionDevelopmentPath = path.resolve(__dirname, "../../../../")
		const extensionTestsPath = path.resolve(__dirname, "./suite/index")

		await runTests({ extensionDevelopmentPath, extensionTestsPath })
	} catch (err) {
		console.error("Failed to run tests")
		process.exit(1)
	}
}

main()
