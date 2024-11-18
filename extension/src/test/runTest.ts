// src/test/runTest.ts

import * as path from "path"
import { runTests } from "@vscode/test-electron"

async function main() {
	try {
		const extensionDevelopmentPath = path.resolve(__dirname, "../../../../")
		const extensionTestsPath = path.resolve(__dirname, "./suite/index")

		const testWorkspace = path.resolve(__dirname, "../../../../")
		const firstArg = path.resolve(process.cwd(), "../eval_data/" + process.argv[2])

		await runTests({
			extensionDevelopmentPath,
			extensionTestsPath,
			launchArgs: [firstArg ?? testWorkspace],
		})
	} catch (err) {
		console.error(err)
		console.error("Failed to run tests")
		process.exit(1)
	}
}

main()
