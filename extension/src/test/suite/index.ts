// src/test/suite/index.ts

import * as path from "path"
import Mocha from "mocha"
import { glob } from "glob"

export function run(): Promise<void> {
	// Create the Mocha test instance
	const mocha = new Mocha({
		ui: "bdd",
		color: true,
		timeout: 1000 * 60 * 20 + 10 * 1000,
	})

	const testsRoot = path.resolve(__dirname)

	return new Promise((resolve, reject) => {
		glob("**/*.test.js", { cwd: testsRoot })
			.then((files) => {
				// Add files to the test suite
				files.forEach((file) => mocha.addFile(path.resolve(testsRoot, file)))

				try {
					// Run the Mocha test suite
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
