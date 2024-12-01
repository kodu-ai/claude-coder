import { jest } from "@jest/globals"
import { getCommandManager } from "../../../src/agent/v1/tools/runners/execute-command/execa-manager"
import { execa } from "execa"
import type { ChildProcess } from "child_process"
import { EventEmitter } from "events"

// Mock execa
jest.mock("execa")
const mockExeca = execa as jest.MockedFunction<typeof execa>

describe("CommandManager", () => {
	let manager: ReturnType<typeof getCommandManager>
	let mockChildProcess: ChildProcess
	let mockStdout: EventEmitter
	let mockStderr: EventEmitter
	let mockStdin: { write: jest.Mock }

	beforeEach(() => {
		// Reset mocks
		jest.clearAllMocks()

		// Create new event emitters for each test
		mockStdout = new EventEmitter()
		mockStderr = new EventEmitter()
		mockStdin = { write: jest.fn() }

		// Create mock child process
		mockChildProcess = new EventEmitter() as ChildProcess
		Object.assign(mockChildProcess, {
			stdout: mockStdout,
			stderr: mockStderr,
			stdin: mockStdin,
			kill: jest.fn(),
		})

		// Setup execa mock
		mockExeca.mockImplementation(() => {
			const promise = Promise.resolve({
				exitCode: 0,
				stdout: "",
				stderr: "",
				// Add other required ExecaReturnValue properties
			})
			return Object.assign(promise, mockChildProcess)
		})

		// Get fresh instance for each test
		manager = getCommandManager("test-command")
	})

	describe("executeBlockingCommand", () => {
		it("should execute a command successfully", async () => {
			const result = manager.executeBlockingCommand("echo", ["hello"])

			mockStdout.emit("data", Buffer.from("hello\n"))
			mockChildProcess.emit("exit", 0)

			const output = await result
			expect(output).toEqual({
				output: "hello\n",
				exitCode: 0,
				completed: true,
			})
			expect(mockExeca).toHaveBeenCalledWith("echo", ["hello"], expect.any(Object))
		})

		it("should handle command timeout", async () => {
			mockExeca.mockImplementation(() => {
				const error: any = new Error("Command timed out")
				error.timedOut = true
				return Promise.reject(error)
			})

			const result = await manager.executeBlockingCommand("sleep", ["10"], { timeout: 1 })
			expect(result).toEqual({
				output: "",
				exitCode: -1,
				completed: false,
			})
		})

		it("should enforce output line limits", async () => {
			const result = manager.executeBlockingCommand("test", [], { outputMaxLines: 2 })

			mockStdout.emit("data", Buffer.from("line1\nline2\nline3\n"))

			await result
			expect(mockChildProcess.kill).toHaveBeenCalled()
		})

		it("should enforce output token limits", async () => {
			const result = manager.executeBlockingCommand("test", [], { outputMaxTokens: 5 })

			mockStdout.emit("data", Buffer.from("123456"))

			await result
			expect(mockChildProcess.kill).toHaveBeenCalled()
		})

		it("should enforce output byte limits", async () => {
			const result = manager.executeBlockingCommand("test", [], { outputMaxBytes: 5 })

			mockStdout.emit("data", Buffer.from("123456"))

			await result
			expect(mockChildProcess.kill).toHaveBeenCalled()
		})

		it("should prevent multiple concurrent commands", async () => {
			// Start first command
			const firstCommand = manager.executeBlockingCommand("test", [])

			// Try to start second command
			await expect(manager.executeBlockingCommand("test", [])).rejects.toThrow("A command is already running")

			// Complete first command
			mockChildProcess.emit("exit", 0)
			await firstCommand
		})
	})

	describe("resumeBlockingCommand", () => {
		it("should resume a running command", async () => {
			// Start command
			const executePromise = manager.executeBlockingCommand("test", [])
			mockStdout.emit("data", Buffer.from("initial output\n"))

			// Resume command
			const resumePromise = manager.resumeBlockingCommand({ stdin: "input\n" })
			mockStdout.emit("data", Buffer.from("more output\n"))
			mockChildProcess.emit("exit", 0)

			const result = await resumePromise
			expect(result).toEqual({
				output: "initial output\nmore output\n",
				exitCode: 0,
				completed: true,
			})
			expect(mockStdin.write).toHaveBeenCalledWith("input\n")
		})

		it("should handle resume timeout", async () => {
			// Start command
			await manager.executeBlockingCommand("test", [])

			// Resume with timeout
			const result = await manager.resumeBlockingCommand({ timeout: 1 })

			expect(result).toEqual({
				output: "",
				exitCode: -1,
				completed: false,
			})
		})

		it("should prevent resuming when no command is running", async () => {
			await expect(manager.resumeBlockingCommand()).rejects.toThrow("No command is currently running")
		})
	})

	describe("terminateBlockingCommand", () => {
		it("should terminate command with soft kill", async () => {
			// Start command
			const executePromise = manager.executeBlockingCommand("test", [])

			// Terminate command
			const terminatePromise = manager.terminateBlockingCommand()
			mockChildProcess.emit("exit", 0)

			const result = await terminatePromise
			expect(result).toEqual({
				output: "",
				exitCode: -1,
				completed: true,
			})
			expect(mockChildProcess.kill).toHaveBeenCalledWith("SIGTERM")
		})

		it("should use hard kill after soft kill timeout", async () => {
			// Start command
			await manager.executeBlockingCommand("test", [])

			// Terminate command with short timeout
			const terminatePromise = manager.terminateBlockingCommand({ softTimeout: 1 })

			// Wait for soft timeout
			await new Promise((resolve) => setTimeout(resolve, 10))

			expect(mockChildProcess.kill).toHaveBeenCalledWith("SIGKILL")
			await terminatePromise
		})

		it("should prevent terminating when no command is running", async () => {
			await expect(manager.terminateBlockingCommand()).rejects.toThrow("No command is currently running")
		})
	})

	describe("CommandRegistry", () => {
		it("should maintain separate instances for different command IDs", () => {
			const manager1 = getCommandManager("command1")
			const manager2 = getCommandManager("command2")
			const manager1Again = getCommandManager("command1")

			expect(manager1).not.toBe(manager2)
			expect(manager1).toBe(manager1Again)
		})
	})
})
