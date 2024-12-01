// Revised test file
import { getCommandManager } from "../../../src/agent/v1/tools/runners/execute-command/execa-manager"
import { expect } from "chai"
import { nanoid } from "nanoid"
import * as vscode from "vscode"

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
				["-c", 'for i in $(seq 1 5); do echo "line $i"; sleep 0.5; done'],
				{
					timeout: 1000,
				}
			)

			// Resume should get new output
			const result = await manager.resumeBlockingCommand({
				timeout: 2000,
			})

			expect(result.output).to.not.be.empty
			expect(result.completed).to.be.false
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

			expect(manager1.id).to.not.equal(manager2.id)
			expect(manager1.id).to.equal(manager1Again.id)
		})
	})
})
