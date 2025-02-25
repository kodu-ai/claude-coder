import { z } from "zod"
import ToolParser from "./tool-parser"
import { jsWriteToFileTool } from "./test-utils"
import { DialectType } from "./base-dialect-parser"

describe("ToolParser", () => {
	// Define common test utilities and schemas
	const writeFileSchema = z.object({
		path: z.string(),
		value: z.string(),
	})

	const readFileSchema = z.object({
		path: z.string(),
	})

	const toolSchemas = [
		{
			name: "writeFile",
			schema: writeFileSchema,
		},
		{
			name: "readFile",
			schema: readFileSchema,
		},
	]

	// Test helpers
	const objectToXml = (obj: Record<string, any>): string => {
		const { toolName, ...params } = obj
		let xml = `<${toolName}>`
		for (const [key, value] of Object.entries(params)) {
			xml += `<${key}>${value}</${key}>`
		}
		xml += `</${toolName}>`
		return xml
	}

	const objectToJson = (obj: Record<string, any>): string => {
		const { toolName, ...params } = obj
		return JSON.stringify({
			tool: toolName,
			params: params,
		})
	}

	// Tests for multiple dialects
	const dialects: DialectType[] = ["xml", "json"]

	// Parameterized test for each dialect
	dialects.forEach((dialect) => {
		describe(`${dialect.toUpperCase()} Dialect Parser`, () => {
			let toolParser: ToolParser
			let onToolUpdateMock: jest.Mock
			let onToolEndMock: jest.Mock
			let onToolErrorMock: jest.Mock
			let onToolClosingErrorMock: jest.Mock

			// Convert between formats depending on the dialect
			const formatToolObject = (obj: Record<string, any>): string => {
				return dialect === "xml" ? objectToXml(obj) : objectToJson(obj)
			}

			const simulateStream = (text: string) => {
				for (let i = 0; i < text.length; i++) {
					toolParser.appendText(text[i])
				}
			}

			beforeEach(() => {
				onToolUpdateMock = jest.fn()
				onToolEndMock = jest.fn()
				onToolErrorMock = jest.fn()
				onToolClosingErrorMock = jest.fn()

				toolParser = new ToolParser(
					toolSchemas,
					{
						dialect,
						onToolEnd: onToolEndMock,
						onToolUpdate: onToolUpdateMock,
						onToolError: onToolErrorMock,
						onToolClosingError: onToolClosingErrorMock,
					},
					true
				)

				jest.useFakeTimers()
				jest.setSystemTime(new Date("2023-01-01"))
			})

			afterEach(() => {
				jest.useRealTimers()
			})

			test("should process a valid writeFile tool", () => {
				const toolObj = {
					toolName: "writeFile",
					path: "/tmp/test.txt",
					value: "Hello, World!",
				}
				const formattedTool = formatToolObject(toolObj)

				simulateStream(formattedTool)

				// Validate end result
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
				const formattedTool = formatToolObject(toolObj)

				simulateStream(formattedTool)

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
				const formattedTools = toolObjs.map(formatToolObject).join("\n")

				simulateStream(formattedTools)

				expect(onToolErrorMock).not.toHaveBeenCalled()
				expect(onToolClosingErrorMock).not.toHaveBeenCalled()
			})

			test("should handle incomplete tool input", () => {
				// Create incomplete input based on dialect
				let incompleteInput: string

				if (dialect === "xml") {
					const toolObj = {
						toolName: "writeFile",
						path: "/tmp/test.txt",
						value: "Hello, World!",
					}
					const xml = objectToXml(toolObj)
					incompleteInput = xml.slice(0, xml.indexOf("</writeFile>") - 1)
				} else {
					// For JSON, create a partial JSON object
					incompleteInput = '{"tool":"writeFile","params":{"path":"/tmp/test.txt","value":"Hello'
				}

				simulateStream(incompleteInput)
				toolParser.endParsing()

				expect(onToolEndMock).not.toHaveBeenCalled()
				expect(onToolClosingErrorMock).toHaveBeenCalledWith(expect.any(Error))
			})
		})
	})

	// Legacy XML-specific tests for backward compatibility
	describe("Additional XML Parser Compatibility", () => {
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
				toolSchemas,
				{
					dialect: "xml",
					onToolEnd: onToolEndMock,
					onToolUpdate: onToolUpdateMock,
					onToolError: onToolErrorMock,
					onToolClosingError: onToolClosingErrorMock,
				},
				true
			)

			jest.useFakeTimers()
			jest.setSystemTime(new Date("2023-01-01"))
		})

		afterEach(() => {
			jest.useRealTimers()
		})

		const simulateStream = (xml: string) => {
			for (let i = 0; i < xml.length; i++) {
				toolParser.appendText(xml[i])
			}
		}

		test("should handle complicated write_to_file", () => {
			const toolObj = jsWriteToFileTool
			const toolXml = objectToXml(toolObj)

			simulateStream(toolXml)

			// Verify final update
			const lastCall = onToolUpdateMock.mock.calls[onToolUpdateMock.mock.calls.length - 1]
			expect(lastCall[1]).toBe("writeFile")
		})
	})
})
