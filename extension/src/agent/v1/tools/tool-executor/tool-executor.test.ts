// tool-executor.test.ts
import { z } from "zod"
import ToolExecutor from "./tool-executor"

describe("ToolExecutor", () => {
	const writeFileSchema = z.object({
		toolName: z.literal("writeFile"),
		path: z.string(),
		content: z.string(),
	})

	const readFileSchema = z.object({
		toolName: z.literal("readFile"),
		path: z.string(),
	})

	let toolExecutor: ToolExecutor
	let onToolUpdateMock: jest.Mock
	let onToolEndMock: jest.Mock
	let onToolErrorMock: jest.Mock
	let onToolClosingErrorMock: jest.Mock

	beforeEach(() => {
		toolExecutor = new ToolExecutor([writeFileSchema, readFileSchema])
		onToolUpdateMock = jest.fn()
		onToolEndMock = jest.fn()
		onToolErrorMock = jest.fn()
		onToolClosingErrorMock = jest.fn()
		toolExecutor.onToolUpdate = onToolUpdateMock
		toolExecutor.onToolEnd = onToolEndMock
		toolExecutor.onToolError = onToolErrorMock
		toolExecutor.onToolClosingError = onToolClosingErrorMock
	})

	const objectToXml = (obj: Record<string, any>): string => {
		const { toolName, ...params } = obj
		let xml = `<tool name="${toolName}">`
		for (const [key, value] of Object.entries(params)) {
			xml += `<${key}>${value}</${key}>`
		}
		xml += "</tool>"
		return xml
	}

	const simulateStream = (xml: string) => {
		for (let i = 0; i < xml.length; i++) {
			toolExecutor.appendText(xml[i])
		}
	}

	const countParams = (obj: Record<string, any>): number => {
		return Object.keys(obj).filter((key) => key !== "toolName").length
	}

	test("should process a valid writeFile tool", () => {
		const toolObj = {
			toolName: "writeFile",
			path: "/tmp/test.txt",
			content: "Hello, World!",
		}
		const toolXml = objectToXml(toolObj)

		simulateStream(toolXml)

		expect(onToolUpdateMock).toHaveBeenCalledTimes(countParams(toolObj))
		expect(onToolUpdateMock).toHaveBeenLastCalledWith("writeFile", {
			path: "/tmp/test.txt",
			content: "Hello, World!",
		})
		expect(onToolEndMock).toHaveBeenCalledTimes(1)
		expect(onToolEndMock).toHaveBeenCalledWith("writeFile", toolObj)
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

		expect(onToolUpdateMock).toHaveBeenCalledTimes(countParams(toolObj))
		expect(onToolUpdateMock).toHaveBeenLastCalledWith("readFile", {
			path: "/tmp/test.txt",
		})
		expect(onToolEndMock).toHaveBeenCalledTimes(1)
		expect(onToolEndMock).toHaveBeenCalledWith("readFile", toolObj)
		expect(onToolErrorMock).not.toHaveBeenCalled()
		expect(onToolClosingErrorMock).not.toHaveBeenCalled()
	})

	test("should handle multiple tools in a single input", () => {
		const toolObjs = [
			{ toolName: "writeFile", path: "/tmp/test1.txt", content: "Hello" },
			{ toolName: "readFile", path: "/tmp/test2.txt" },
		]
		const toolXml = toolObjs.map(objectToXml).join("\n")

		simulateStream(toolXml)

		const expectedUpdates = toolObjs.reduce((sum, obj) => sum + countParams(obj), 0)
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
			content: "Test content",
		}
		const toolXml = objectToXml(toolObj)
		const interruptIndex = Math.floor(toolXml.length / 2)
		const firstPart = toolXml.slice(0, interruptIndex)
		const secondPart = toolXml.slice(interruptIndex)

		simulateStream(firstPart)

		// No parameters are fully parsed yet
		expect(onToolUpdateMock).toHaveBeenCalledTimes(0)
		expect(onToolEndMock).toHaveBeenCalledTimes(0)

		simulateStream(secondPart)

		expect(onToolUpdateMock).toHaveBeenCalledTimes(countParams(toolObj))
		expect(onToolUpdateMock).toHaveBeenLastCalledWith("writeFile", {
			path: "/tmp/test.txt",
			content: "Test content",
		})
		expect(onToolEndMock).toHaveBeenCalledTimes(1)
		expect(onToolErrorMock).not.toHaveBeenCalled()
		expect(onToolClosingErrorMock).not.toHaveBeenCalled()
	})

	test("should handle incomplete tool input", () => {
		const toolObj = {
			toolName: "writeFile",
			path: "/tmp/test.txt",
			content: "Hello, World!",
		}
		const toolXml = objectToXml(toolObj)
		const incompleteXml = toolXml.slice(0, toolXml.indexOf("</tool>") - 1)

		simulateStream(incompleteXml)
		toolExecutor.endParsing()

		// Only one parameter is fully parsed
		expect(onToolUpdateMock).toHaveBeenCalledTimes(1)
		expect(onToolEndMock).not.toHaveBeenCalled()
		expect(onToolErrorMock).not.toHaveBeenCalled()
		expect(onToolClosingErrorMock).toHaveBeenCalledTimes(1)
		expect(onToolClosingErrorMock).toHaveBeenCalledWith(expect.any(Error))
	})

	test("should handle streaming input with multiple tools", () => {
		const toolObjs = [
			{ toolName: "writeFile", path: "/tmp/file1.txt", content: "Content 1" },
			{ toolName: "readFile", path: "/tmp/file2.txt" },
		]
		const toolXml = toolObjs.map(objectToXml).join("\n")

		simulateStream(toolXml)

		const expectedUpdates = toolObjs.reduce((sum, obj) => sum + countParams(obj), 0)
		expect(onToolUpdateMock).toHaveBeenCalledTimes(expectedUpdates)
		expect(onToolEndMock).toHaveBeenCalledTimes(2)
		expect(onToolErrorMock).not.toHaveBeenCalled()
		expect(onToolClosingErrorMock).not.toHaveBeenCalled()
	})

	test("should handle streaming input with incomplete tool at the end", () => {
		const toolObjs = [
			{ toolName: "writeFile", path: "/tmp/complete.txt", content: "Complete content" },
			{ toolName: "readFile", path: "/tmp/incomplete.txt" },
		]
		const toolXml = toolObjs.map(objectToXml).join("\n")
		const incompleteXml = toolXml.slice(0, toolXml.lastIndexOf("</tool>") - 1)

		simulateStream(incompleteXml)
		toolExecutor.endParsing()

		// Only parameters from the first tool are fully parsed
		expect(onToolUpdateMock).toHaveBeenCalledTimes(countParams(toolObjs[0]))
		expect(onToolEndMock).toHaveBeenCalledTimes(1)
		expect(onToolEndMock).toHaveBeenCalledWith("writeFile", toolObjs[0])
		expect(onToolErrorMock).not.toHaveBeenCalled()
		expect(onToolClosingErrorMock).toHaveBeenCalledTimes(1)
		expect(onToolClosingErrorMock).toHaveBeenCalledWith(expect.any(Error))
	})

	test("should call onToolClosingError when interrupted in the middle of wrong tool tags", () => {
		const toolXml = '<tool name="unknownTool"><param>value</param>' // Missing closing </tool>
		simulateStream(toolXml)
		toolExecutor.endParsing()

		expect(onToolUpdateMock).toHaveBeenCalledTimes(0)
		expect(onToolEndMock).toHaveBeenCalledTimes(0)
		expect(onToolErrorMock).not.toHaveBeenCalled()
		expect(onToolClosingErrorMock).toHaveBeenCalledTimes(1)
		expect(onToolClosingErrorMock).toHaveBeenCalledWith(expect.any(Error))
	})
})
