// src/test/runTest.ts

import * as path from "path"
import { runTests } from "@vscode/test-electron"

async function main() {
	try {
		const extensionDevelopmentPath = path.resolve(__dirname, "../../../../")
		const extensionTestsPath = path.resolve(__dirname, "./suite/index")

		const testWorkspace = path.resolve(__dirname, "../../../../")
		const firstArg = path.resolve(process.cwd(), "../eval_data/" + process.argv[2])

		// Get test name from environment variable
		const testName = process.env.TEST_NAME || ""

		await runTests({
			extensionDevelopmentPath,
			extensionTestsPath,
			launchArgs: [firstArg ?? testWorkspace],
			// Pass the test name to the test environment
			extensionTestsEnv: { TEST_NAME: testName },
		})
	} catch (err) {
		console.error(err)
		console.error("Failed to run tests")
		process.exit(1)
	}
}

main()
