// src/test/suite/index.ts

import * as path from "path"
import Mocha from "mocha"
import { glob } from "glob"

export function run(): Promise<void> {
	// Retrieve the test name from the environment variable
	const testName = process.env.TEST_NAME

	// Create the Mocha test instance with the grep option
	const mocha = new Mocha({
		ui: "bdd",
		color: true,
		timeout: 1000 * 60 * 60 * 4 + 10 * 1000,
		grep: testName ? new RegExp(testName) : undefined,
	})

	const testsRoot = path.resolve(__dirname)

	return new Promise((resolve, reject) => {
		glob("**/*.test.js", { cwd: testsRoot })
			.then((files: string[]) => {
				// Add files to the test suite
				files.forEach((file) => mocha.addFile(path.resolve(testsRoot, file)))

				try {
					// Run the Mocha test suite
					mocha.run((failures) => {
						if (failures > 0) {
							reject(new Error(`${failures} tests failed.`))
						} else {
							resolve()
						}
					})
				} catch (err) {
					reject(err)
				}
			})
			.catch(reject)
	})
}
