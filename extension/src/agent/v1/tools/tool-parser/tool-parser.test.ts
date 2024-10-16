import { z } from "zod"
import { nanoid } from "nanoid"
import ToolParser from "./tool-parser"
import { jsWriteToFileTool } from "./test-utils"

describe("ToolParser", () => {
	const writeFileSchema = z.object({
		path: z.string(),
		value: z.string(),
	})

	const readFileSchema = z.object({
		path: z.string(),
	})

	let toolParser: ToolParser
	let onToolUpdateMock: jest.Mock
	let onToolEndMock: jest.Mock
	let onToolErrorMock: jest.Mock
	let onToolClosingErrorMock: jest.Mock

	beforeEach(() => {
		onToolUpdateMock = jest.fn()
		onToolEndMock = jest.fn()
		onToolErrorMock = jest.fn()
		onToolClosingErrorMock = jest.fn()
		toolParser = new ToolParser(
			[
				{
					name: "writeFile",
					schema: writeFileSchema,
				},
				{
					name: "readFile",
					schema: readFileSchema,
				},
			],
			{
				onToolEnd: onToolEndMock,
				onToolUpdate: onToolUpdateMock,
				onToolError: onToolErrorMock,
				onToolClosingError: onToolClosingErrorMock,
			}
		)
		jest.useFakeTimers()
		jest.setSystemTime(new Date("2023-01-01"))
	})

	afterEach(() => {
		jest.useRealTimers()
	})

	const objectToXml = (obj: Record<string, any>): string => {
		const { toolName, ...params } = obj
		let xml = `<${toolName}>`
		for (const [key, value] of Object.entries(params)) {
			xml += `<${key}>${value}</${key}>`
		}
		xml += `</${toolName}>`
		return xml
	}

	const simulateStream = (xml: string) => {
		for (let i = 0; i < xml.length; i++) {
			toolParser.appendText(xml[i])
		}
	}

	const countExpectedUpdates = (obj: Record<string, any>): number => {
		return Object.entries(obj).reduce((count, [key, value]) => {
			if (key === "toolName") {
				return count
			} else if (key === "value") {
				return count + value.length // One update per character in 'value'
			} else {
				return count + 1 // One update per other parameter
			}
		}, 0)
	}

	test("should process a valid writeFile tool", () => {
		const toolObj = {
			toolName: "writeFile",
			path: "/tmp/test.txt",
			value: "Hello, World!",
		}
		const toolXml = objectToXml(toolObj)

		simulateStream(toolXml)

		const expectedUpdates = countExpectedUpdates(toolObj)
		expect(onToolUpdateMock).toHaveBeenCalledTimes(expectedUpdates)

		// Verify that updates for 'value' are called with the content growing character by character
		const value = toolObj.value
		let accumulatedValue = ""
		let callIndex = 0

		// First, the 'path' parameter update
		expect(onToolUpdateMock.mock.calls[callIndex][0]).toBe("mocked-nanoid")
		expect(onToolUpdateMock.mock.calls[callIndex][1]).toBe("writeFile")
		expect(onToolUpdateMock.mock.calls[callIndex][2]).toEqual({
			path: toolObj.path,
		})
		expect(onToolUpdateMock.mock.calls[callIndex][3]).toBe(new Date("2023-01-01").getTime())
		callIndex++

		// Then, updates for each character in 'value'
		for (let i = 0; i < value.length; i++) {
			accumulatedValue += value[i]
			expect(onToolUpdateMock.mock.calls[callIndex][0]).toBe("mocked-nanoid")
			expect(onToolUpdateMock.mock.calls[callIndex][1]).toBe("writeFile")
			expect(onToolUpdateMock.mock.calls[callIndex][2]).toEqual({
				path: toolObj.path,
				value: accumulatedValue,
			})
			expect(onToolUpdateMock.mock.calls[callIndex][3]).toBe(new Date("2023-01-01").getTime())
			callIndex++
		}

		expect(onToolEndMock).toHaveBeenCalledTimes(1)
		expect(onToolEndMock).toHaveBeenCalledWith(
			"mocked-nanoid",
			"writeFile",
			{
				path: toolObj.path,
				value: toolObj.value,
			},
			new Date("2023-01-01").getTime()
		)
		expect(onToolErrorMock).not.toHaveBeenCalled()
		expect(onToolClosingErrorMock).not.toHaveBeenCalled()
	})

	test("should process a valid readFile tool", () => {
		const toolObj = {
			toolName: "readFile",
			path: "/tmp/test.txt",
		}
		const toolXml = objectToXml(toolObj)

		simulateStream(toolXml)

		const expectedUpdates = countExpectedUpdates(toolObj)
		expect(onToolUpdateMock).toHaveBeenCalledTimes(expectedUpdates)

		// Verify that 'path' parameter update is correct
		expect(onToolUpdateMock).toHaveBeenCalledWith(
			"mocked-nanoid",
			"readFile",
			{
				path: toolObj.path,
			},
			new Date("2023-01-01").getTime()
		)

		expect(onToolEndMock).toHaveBeenCalledTimes(1)
		expect(onToolEndMock).toHaveBeenCalledWith(
			"mocked-nanoid",
			"readFile",
			{
				path: toolObj.path,
			},
			new Date("2023-01-01").getTime()
		)
		expect(onToolErrorMock).not.toHaveBeenCalled()
		expect(onToolClosingErrorMock).not.toHaveBeenCalled()
	})

	test("should handle multiple tools in a single input", () => {
		const toolObjs = [
			{ toolName: "writeFile", path: "/tmp/test1.txt", value: "Hello" },
			{ toolName: "readFile", path: "/tmp/test2.txt" },
		]
		const toolXml = toolObjs.map(objectToXml).join("\n")

		simulateStream(toolXml)

		const expectedUpdates = toolObjs.reduce((sum, obj) => sum + countExpectedUpdates(obj), 0)
		expect(onToolUpdateMock).toHaveBeenCalledTimes(expectedUpdates)
		expect(onToolEndMock).toHaveBeenCalledTimes(2)
		expect(onToolErrorMock).not.toHaveBeenCalled()
		expect(onToolClosingErrorMock).not.toHaveBeenCalled()
	})

	test("should handle invalid tools", () => {
		const toolObj = {
			toolName: "invalidTool",
			param: "value",
		}
		const toolXml = objectToXml(toolObj)

		simulateStream(toolXml)

		expect(onToolUpdateMock).toHaveBeenCalledTimes(0)
		expect(onToolEndMock).not.toHaveBeenCalled()
		expect(onToolErrorMock).not.toHaveBeenCalled() // No error since we skip unknown tools
		expect(onToolClosingErrorMock).not.toHaveBeenCalled()
	})

	test("should handle interrupted stream", () => {
		const toolObj = {
			toolName: "writeFile",
			path: "/tmp/test.txt",
			value: "Test content",
		}
		const toolXml = objectToXml(toolObj)
		const interruptIndex = Math.floor(toolXml.length / 2)
		const firstPart = toolXml.slice(0, interruptIndex)
		const secondPart = toolXml.slice(interruptIndex)

		simulateStream(firstPart)

		// Updates may have been called depending on how much of 'value' was parsed
		expect(onToolEndMock).toHaveBeenCalledTimes(0)

		simulateStream(secondPart)

		const expectedUpdates = countExpectedUpdates(toolObj)
		expect(onToolUpdateMock).toHaveBeenCalledTimes(expectedUpdates)
		expect(onToolEndMock).toHaveBeenCalledTimes(1)
		expect(onToolErrorMock).not.toHaveBeenCalled()
		expect(onToolClosingErrorMock).not.toHaveBeenCalled()
	})

	test("should handle incomplete tool input", () => {
		const toolObj = {
			toolName: "writeFile",
			path: "/tmp/test.txt",
			value: "Hello, World!",
		}
		const toolXml = objectToXml(toolObj)
		const incompleteXml = toolXml.slice(0, toolXml.indexOf("</writeFile>") - 1)

		simulateStream(incompleteXml)
		toolParser.endParsing()

		// Updates may have been called depending on how much was parsed before interruption
		expect(onToolEndMock).not.toHaveBeenCalled()
		expect(onToolErrorMock).not.toHaveBeenCalled()
		expect(onToolClosingErrorMock).toHaveBeenCalledTimes(1)
		expect(onToolClosingErrorMock).toHaveBeenCalledWith(expect.any(Error))
	})

	test("should handle streaming input with multiple tools", () => {
		const toolObjs = [
			{ toolName: "writeFile", path: "/tmp/file1.txt", value: "Content 1" },
			{ toolName: "readFile", path: "/tmp/file2.txt" },
		]
		const toolXml = toolObjs.map(objectToXml).join("\n")

		simulateStream(toolXml)

		const expectedUpdates = toolObjs.reduce((sum, obj) => sum + countExpectedUpdates(obj), 0)
		expect(onToolUpdateMock).toHaveBeenCalledTimes(expectedUpdates)
		expect(onToolEndMock).toHaveBeenCalledTimes(2)
		expect(onToolErrorMock).not.toHaveBeenCalled()
		expect(onToolClosingErrorMock).not.toHaveBeenCalled()
	})

	test("should handle streaming input with incomplete tool at the end", () => {
		const toolObjs = [
			{ toolName: "writeFile", path: "/tmp/complete.txt", value: "Complete content" },
			{ toolName: "readFile", path: "/tmp/incomplete.txt" },
		]
		const toolXml = toolObjs.map(objectToXml).join("\n")
		const incompleteXml = toolXml.slice(0, toolXml.lastIndexOf("</readFile>") - 1)

		simulateStream(incompleteXml)
		toolParser.endParsing()

		// Updates for the first tool should be complete
		const expectedUpdatesFirstTool = countExpectedUpdates(toolObjs[0])
		expect(onToolUpdateMock).toHaveBeenCalledTimes(expectedUpdatesFirstTool + 1) // +1 for the incomplete readFile
		expect(onToolEndMock).toHaveBeenCalledTimes(1)
		expect(onToolEndMock).toHaveBeenCalledWith(
			"mocked-nanoid",
			"writeFile",
			{
				path: "/tmp/complete.txt",
				value: "Complete content",
			},
			new Date("2023-01-01").getTime()
		)
		expect(onToolErrorMock).not.toHaveBeenCalled()
		expect(onToolClosingErrorMock).toHaveBeenCalledTimes(1)
		expect(onToolClosingErrorMock).toHaveBeenCalledWith(expect.any(Error))
	})

	test("should call onToolClosingError when interrupted in the middle of wrong tool tags", () => {
		const toolXml = "<invalidTool><param>value</param>" // Missing closing </invalidTool>
		simulateStream(toolXml)
		toolParser.endParsing()

		expect(onToolUpdateMock).toHaveBeenCalledTimes(0)
		expect(onToolEndMock).toHaveBeenCalledTimes(0)
		expect(onToolErrorMock).not.toHaveBeenCalled()
		expect(onToolClosingErrorMock).toHaveBeenCalledTimes(1)
		expect(onToolClosingErrorMock).toHaveBeenCalledWith(expect.any(Error))
	})

	test("should handle complicated write_to_file", () => {
		const toolObj = jsWriteToFileTool
		const toolXml = objectToXml(toolObj)

		simulateStream(toolXml)

		// const expectedUpdates = countExpectedUpdates(toolObj)
		// expect(onToolUpdateMock).toHaveBeenCalledTimes(expectedUpdates)

		// Verify final update
		const lastCall = onToolUpdateMock.mock.calls[onToolUpdateMock.mock.calls.length - 1]
		expect(lastCall[1]).toBe("writeFile")
		// expect(lastCall[2]).toEqual(toolParser)
		// expect(lastCall[3]).toBe(new Date("2023-01-01").getTime())
	})
})
