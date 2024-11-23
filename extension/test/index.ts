import * as path from "node:path";
import { runTests } from "@vscode/test-electron";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
	try {
		// Path to the extension's root directory
		const extensionDevelopmentPath = path.resolve(__dirname, "../")

		// Path to the test suite
		const extensionTestsPath = path.resolve(__dirname, "./suite")

		// Run the integration tests
		await runTests({
			extensionDevelopmentPath,
			extensionTestsPath,
		})
	} catch (err) {
		console.error("Failed to run tests")
		process.exit(1)
	}
}

main()