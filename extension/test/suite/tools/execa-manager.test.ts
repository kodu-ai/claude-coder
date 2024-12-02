// Updated test file
import { getCommandManager } from "../../../src/agent/v1/tools/runners/execute-command/execa-manager"
import { expect } from "chai"
import { nanoid } from "nanoid"

describe("CommandManager", () => {
	describe("executeBlockingCommand", () => {
		it("should complete normally for quick commands", async () => {
			const { manager } = getCommandManager(nanoid())

			const result = await manager.executeBlockingCommand("echo", ["test"])
			expect(result.completed).to.be.true
			expect(result.output).to.include("test")
			expect(result.exitCode).to.equal(0)
		})

		it("should timeout but keep process running", async () => {
			// Start a long process with short timeout
			const { manager } = getCommandManager(nanoid())

			const result = await manager.executeBlockingCommand("sleep", ["5"], {
				timeout: 1000,
			})

			expect(result.completed).to.be.false
			expect(result.exitCode).to.equal(-1)

			// Verify process still running
			try {
				await manager.executeBlockingCommand("echo", ["test"])
				expect.fail("Should not allow new command while one is running")
			} catch (error) {
				expect((error as Error).message).to.equal("A command is already running")
			}
		})

		it("should handle output limits like timeout", async function () {
			const { manager } = getCommandManager(nanoid())

			const result = await manager.executeBlockingCommand(
				"bash",
				["-c", 'for i in $(seq 1 100); do echo "line $i"; done'],
				{
					outputMaxLines: 10,
				}
			)

			console.info("Output:", result.output)
			expect(result.completed).to.be.false
			expect(result.output.split("\n").filter((l) => l.length > 0).length).to.equal(10)

			// Process should still be running
			expect(manager.currentProcess).to.not.be.null
		})
	})

	describe("resumeBlockingCommand", () => {
		it("should continue monitoring existing process", async function () {
			const { manager } = getCommandManager(nanoid())

			// Start process that outputs slowly
			await manager.executeBlockingCommand(
				"bash",
				["-c", 'for i in $(seq 1 10); do echo "line $i"; sleep 1; done'],
				{
					timeout: 1000,
				}
			)

			// Resume should get new output
			const result = await manager.resumeBlockingCommand({
				timeout: 1000,
			})

			expect(result.output).to.not.be.empty
			expect(result.completed).to.be.false
			expect(manager.currentProcess).to.not.be.null
		})

		it("should handle stdin properly", async function () {
			const { manager } = getCommandManager(nanoid())

			// Start grep process that echoes input lines containing 'line'
			await manager.executeBlockingCommand("grep", ["--line-buffered", "line"], {
				timeout: 2000,
			})

			const result = await manager.resumeBlockingCommand({
				stdin: "hello\nline one\nworld\nline two\n",
				timeout: 2000,
			})

			expect(result.output).to.include("line one")
			expect(result.output).to.include("line two")
		})

		it("should respect output limits", async function () {
			const { manager } = getCommandManager(nanoid())

			await manager.executeBlockingCommand("grep", ["--line-buffered", "."], {
				timeout: 2000,
			})

			const testInput = Array(100).fill("test\n").join("")

			const result = await manager.resumeBlockingCommand({
				stdin: testInput,
				outputMaxLines: 5,
			})

			const outputLines = result.output.split("\n").filter((l) => l.trim().length > 0)
			expect(outputLines.length).to.equal(5)
			expect(result.completed).to.be.false
		})
	})

	describe("terminateBlockingCommand", () => {
		it("should continue monitoring existing process", async function () {
			const { manager } = getCommandManager(nanoid())

			// Start process that outputs slowly over 10 seconds
			await manager.executeBlockingCommand(
				"bash",
				["-c", 'for i in $(seq 1 10); do echo "line $i"; sleep 1; done'],
				{
					timeout: 2000,
				}
			)

			// Resume with a timeout of 3 seconds
			const result = await manager.resumeBlockingCommand({
				timeout: 3000,
			})

			expect(result.output).to.not.be.empty

			// The process should still be running
			expect(result.completed).to.be.false
			expect(manager.currentProcess).to.not.be.null
		})

		it("should do hard kill after soft timeout", async function () {
			const { manager } = getCommandManager(nanoid())

			// Start process that ignores SIGTERM
			await manager.executeBlockingCommand("bash", ["-c", 'trap "" TERM; sleep 10'], {
				timeout: 1000,
			})

			const start = Date.now()
			await manager.terminateBlockingCommand({ softTimeout: 1000 })
			const duration = Date.now() - start

			// Should take about 1 second for soft timeout plus time for hard kill
			expect(duration).to.be.within(1000, 7000)
		})
	})

	describe("CommandRegistry", () => {
		it("should maintain separate instances for different command IDs", () => {
			const manager1 = getCommandManager("cmd1")
			const manager2 = getCommandManager("cmd2")
			const manager1Again = getCommandManager("cmd1")

			expect(manager1.id).to.equal("cmd1")
			expect(manager2.id).to.equal("cmd2")
			expect(manager1.id).to.equal(manager1Again.id)
		})
	})

	describe("Edge Cases and Challenging Scenarios", () => {
		it("should handle multiple resume calls with varying timeouts", async function () {
			const { manager } = getCommandManager(nanoid())

			// Start a slow process that consistently outputs
			await manager.executeBlockingCommand(
				"bash",
				["-c", 'for i in $(seq 1 20); do echo "line $i"; sleep 0.1; done'],
				{ timeout: 100 }
			)

			// Sequential resumes with different timeouts
			const results = []
			for (let i = 0; i < 3; i++) {
				const result = await manager.resumeBlockingCommand({
					timeout: [300, 50, 500][i],
				})
				results.push(result)
				expect(result.output).to.not.be.empty
				// Small delay between resumes to ensure we get new output
				await new Promise((resolve) => setTimeout(resolve, 200))
			}
		})

		it("should handle process termination during output collection", async function () {
			const { manager } = getCommandManager(nanoid() + "test")

			const result2 = await manager.executeBlockingCommand(
				"bash",
				[
					"-c",
					`
				for i in $(seq 1 100); do 
				  echo "line $i"
				  if [ $i -eq 50 ]; then
					kill -TERM $$
					sleep 1  # Give some time for the output to be captured
				  fi
				done
			  `,
				],
				{ outputMaxLines: 30 }
			)
			console.log(`Result2: ${result2.output}`)

			const result = await manager.resumeBlockingCommand({ timeout: 5000 })
			console.log(`Result: ${result.output}`)
			const lines = result.output.split("\n").filter((l) => l.length > 0)

			console.info("Captured Lines:", lines.join("\n"))
			expect(lines.length).to.equal(20) // Lines from 31 to 50
			expect(result.completed).to.be.true
		})

		it("should handle process that writes partial lines", async function () {
			const { manager } = getCommandManager(nanoid())

			const initialResult = await manager.executeBlockingCommand(
				"bash",
				[
					"-c",
					`
          printf "part1\\n"
          sleep 0.1
          for i in $(seq 2 5); do
            printf "part%d\\n" $i
            sleep 0.5
          done
          `,
				],
				{ timeout: 1000 } // Increased timeout to ensure part1 is captured
			)

			let output = initialResult.output // Include initial output

			for (let i = 0; i < 4; i++) {
				const result = await manager.resumeBlockingCommand({ timeout: 1000 })
				output += result.output
				// Add small delay between resumes
				await new Promise((resolve) => setTimeout(resolve, 200))
			}

			// Verify each part appears exactly once and in order
			for (let i = 1; i <= 5; i++) {
				const regex = new RegExp(`part${i}`)
				const matches = output.match(regex) || []
				expect(matches.length).to.equal(1, `Expected part${i} to appear exactly once`)
			}
		})

		it("should handle very rapid output bursts correctly", async function () {
			const { manager } = getCommandManager(nanoid())

			const result = await manager.executeBlockingCommand(
				"bash",
				[
					"-c",
					`
          for i in $(seq 1 1000); do
            echo "line $i"
            sleep 0.001
          done
        `,
				],
				{ outputMaxLines: 100 }
			)

			const lines = result.output.split("\n").filter((l) => l.length > 0)
			expect(lines.length).to.equal(100)

			const resume = await manager.resumeBlockingCommand({ outputMaxLines: 100 })
			const resumeLines = resume.output.split("\n").filter((l) => l.length > 0)
			expect(resumeLines[0]).to.match(/line (10[1-9]|1[1-9][0-9]|200)/)
		})

		it("should handle large stdin writes correctly", async () => {
			const { manager } = getCommandManager(nanoid())

			// Start a cat process
			await manager.executeBlockingCommand("cat", [], { timeout: 1000 })

			// Create large input
			const largeInput = Array(10000).fill("a").join("") + "\n"

			const result = await manager.resumeBlockingCommand({
				stdin: largeInput,
				outputMaxTokens: 1000,
				timeout: 2000,
			})

			expect(result.output.length).to.equal(1000)
			expect(result.completed).to.be.false
		})

		it("should maintain output order when alternating between stdout and stderr", async () => {
			const { manager } = getCommandManager(nanoid())

			const result = await manager.executeBlockingCommand(
				"bash",
				[
					"-c",
					`
          for i in $(seq 1 10); do
            echo "out $i"
            sleep 0.01
            echo "err $i" >&2
          done
        `,
				],
				{ outputMaxLines: 15 }
			)

			const lines = result.output.split("\n").filter((l) => l.length > 0)
			let outCount = 1,
				errCount = 1
			for (const line of lines) {
				if (line.startsWith("out")) {
					expect(line).to.include(`out ${outCount++}`)
				} else {
					expect(line).to.include(`err ${errCount++}`)
				}
			}
		})
	})

	// describe("Interactive Commands", () => {
	// 	it("should handle interactive commands with EOF properly", async () => {
	// 		const { manager } = getCommandManager(nanoid())

	// 		// Python code as a single properly escaped string
	// 		const pythonCode =
	// 			'x=input("Enter name: ");print(f"Hello {x}!");x=input("Enter name: ");print(f"Hello {x}!")'
	// 		await manager.executeBlockingCommand("python3", ["-c", pythonCode], { timeout: 1000 })

	// 		// First interaction
	// 		const result1 = await manager.resumeBlockingCommand({
	// 			stdin: "Alice\n",
	// 			timeout: 1000,
	// 		})
	// 		expect(result1.output).to.include("Enter name:")
	// 		expect(result1.output).to.include("Hello Alice!")
	// 		expect(result1.completed).to.be.false

	// 		// Second interaction
	// 		const result2 = await manager.resumeBlockingCommand({
	// 			stdin: "Bob\n",
	// 			timeout: 1000,
	// 		})
	// 		expect(result2.output).to.include("Enter name:")
	// 		expect(result2.output).to.include("Hello Bob!")
	// 		expect(result2.completed).to.be.false

	// 		// Send EOF
	// 		const result3 = await manager.resumeBlockingCommand({
	// 			stdin: "",
	// 			timeout: 1000,
	// 		})
	// 		expect(result3.completed).to.be.true
	// 	})

	// 	it("should handle interactive command with ctrl+d (EOF) mid-session", async () => {
	// 		const { manager } = getCommandManager(nanoid())

	// 		// We'll use 'read' instead of cat as it's more predictable for line-based input
	// 		await manager.executeBlockingCommand("bash", ["-c", 'read line; echo "$line"'], { timeout: 1000 })

	// 		// Send input
	// 		const result1 = await manager.resumeBlockingCommand({
	// 			stdin: "hello\n",
	// 			timeout: 1000,
	// 		})
	// 		expect(result1.output).to.equal("hello\n")
	// 		expect(result1.completed).to.true // read exits after one line

	// 		// No need for EOF test as read automatically exits
	// 	})

	// 	it("should handle multiple stdin writes before EOF", async () => {
	// 		const { manager } = getCommandManager(nanoid())

	// 		// Use a more controlled bash script
	// 		await manager.executeBlockingCommand(
	// 			"bash",
	// 			[
	// 				"-c",
	// 				`
	// 			while IFS= read -r line; do
	// 				echo "$line"
	// 			done
	// 		`,
	// 			],
	// 			{ timeout: 1000 }
	// 		)

	// 		// Multiple writes with verification
	// 		const inputs = ["first line\n", "second line\n", "third line\n"]

	// 		for (const input of inputs) {
	// 			const result = await manager.resumeBlockingCommand({
	// 				stdin: input,
	// 				timeout: 1000,
	// 			})
	// 			expect(result.output).to.equal(input)
	// 			expect(result.completed).to.be.false
	// 		}

	// 		// Final EOF
	// 		const finalResult = await manager.resumeBlockingCommand({
	// 			stdin: "",
	// 			timeout: 1000,
	// 		})
	// 		expect(finalResult.completed).to.be.true
	// 	})
	// })
})
