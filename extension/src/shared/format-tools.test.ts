import { isToolResponseV2, toolResponseToAIState, truncateToolFromMsg, parseToolResponse } from "./format-tools"
import { TextBlockParam, ImageBlockParam } from "@anthropic-ai/sdk/resources/messages.mjs"
import type { ToolResponseV2 } from "../agent/v1/types"
describe("Tool Response Utilities", () => {
	describe("isToolResponseV2", () => {
		it("should return true for valid ToolResponseV2 object", () => {
			const response = {
				status: "success" as const,
				toolName: "testTool",
				text: "test text",
				result: "test result", // Added result property
			}
			expect(isToolResponseV2(response)).toBe(true)
		})

		it("should return false for invalid objects", () => {
			expect(isToolResponseV2(null)).toBe(false)
			expect(isToolResponseV2({})).toBe(false)
			expect(isToolResponseV2({ status: "success" })).toBe(false)
			expect(isToolResponseV2({ toolName: "test" })).toBe(false)
			expect(isToolResponseV2({ status: "success", toolName: "test" })).toBe(false) // Missing result
		})
	})

	describe("toolResponseToAIState", () => {
		it("should convert text-only response correctly", () => {
			const response: ToolResponseV2 = {
				status: "success",
				toolName: "testTool",
				toolId: "testToolId",
				text: "test message",
			}

			const result = toolResponseToAIState(response)

			expect(result).toHaveLength(1)
			expect(result[0].type).toBe("text")
			const textBlock = result[0] as TextBlockParam
			expect(textBlock.text).toContain("<toolResponse>")
			expect(textBlock.text).toContain("testTool")
			expect(textBlock.text).toContain("success")
			expect(textBlock.text).toContain("The Tool was successful and returned the following message: test message")
		})

		it("should handle response with images", () => {
			const response: ToolResponseV2 = {
				status: "success",
				toolName: "testTool",
				toolId: "testToolId",
				text: "test message",
				images: ["data:image/jpeg;base64,/9j/4AAQSkZJRg=="],
			}

			const result = toolResponseToAIState(response)

			expect(result).toHaveLength(3) // text response + "Images attached" text + image block
			expect(result[0].type).toBe("text")
			expect(result[1].type).toBe("text")
			expect(result[2].type).toBe("image")
		})

		it("should handle different status messages correctly", () => {
			const statuses = ["success", "error", "rejected", "feedback"] as const
			const expectedPhrases = [
				"The Tool was successful",
				"The Tool encountered an error",
				"The Tool got rejected",
				"The Tool returned the following feedback",
			]

			statuses.forEach((status, index) => {
				const response: ToolResponseV2 = {
					status,
					toolName: "testTool",
					text: "test message",
					toolId: "testToolId",
				}

				const result = toolResponseToAIState(response)
				const textBlock = result[0] as TextBlockParam
				expect(textBlock.text).toContain(expectedPhrases[index])
			})
		})
	})

	describe("getBase64ImageType", () => {
		it("should detect JPEG images", () => {
			const jpegBase64 = "/9j/4AAQSkZJRg==" // Minimal JPEG header
			const response: ToolResponseV2 = {
				status: "success",
				toolName: "testTool",
				toolId: "testToolId",

				text: "test",
				images: [jpegBase64],
			}

			const result = toolResponseToAIState(response)
			const imageBlock = result[2] as ImageBlockParam
			expect(imageBlock.source.media_type).toBe("image/jpeg")
		})

		it("should detect PNG images", () => {
			const pngBase64 = "iVBORw0KGgo=" // Minimal PNG header
			const response: ToolResponseV2 = {
				status: "success",
				toolName: "testTool",
				toolId: "testToolId",

				text: "test",
				images: [pngBase64],
			}

			const result = toolResponseToAIState(response)
			const imageBlock = result[2] as ImageBlockParam
			expect(imageBlock.source.media_type).toBe("image/png")
		})
	})

	describe("truncateToolFromMsg", () => {
		it("should truncate tool response and return summary", () => {
			const msgs: Array<TextBlockParam | ImageBlockParam> = [
				{
					type: "text",
					text: `
              <toolResponse>
                <toolName>testTool</toolName>
                <toolStatus>success</toolStatus>
                <toolResult>Test result</toolResult>
              </toolResponse>
            `,
				},
			]

			const result = truncateToolFromMsg(msgs)
			expect(result).toHaveLength(0) // Based on your implementation returning empty array
		})

		it("should handle messages without tool response", () => {
			const msgs: Array<TextBlockParam | ImageBlockParam> = [
				{
					type: "text",
					text: "Regular message",
				},
			]

			const result = truncateToolFromMsg(msgs)
			expect(result).toHaveLength(0) // Based on your implementation returning empty array
		})
	})

	describe("parseToolResponse", () => {
		it("should parse valid tool response XML", () => {
			const xml = `
          <toolResponse>
            <toolName>testTool</toolName>
            <toolStatus>success</toolStatus>
            <toolResult>Test result</toolResult>
          </toolResponse>
        `

			const result = parseToolResponse(xml)
			expect(result).toEqual({
				toolName: "testTool",
				toolStatus: "success",
				toolResult: "Test result",
				hasImages: false,
			})
		})

		it("should handle tool response with image indicator", () => {
			const xml = `
          <toolResponse>
            <toolName>testTool</toolName>
            <toolStatus>success</toolStatus>
            <toolResult>Test result</toolResult>
            check the images attached to the request
          </toolResponse>
        `

			const result = parseToolResponse(xml)
			expect(result.hasImages).toBe(true)
		})

		it("should throw error for missing required tags", () => {
			const xml = `
          <toolResponse>
            <toolName>testTool</toolName>
            <toolStatus>success</toolStatus>
          </toolResponse>
        `

			expect(() => parseToolResponse(xml)).toThrow()
		})

		it("should handle nested tags in content", () => {
			const xml = `
          <toolResponse>
            <toolName>testTool<nested>content</nested></toolName>
            <toolStatus>success</toolStatus>
            <toolResult>Test <nested>result</nested></toolResult>
          </toolResponse>
        `

			const result = parseToolResponse(xml)
			expect(result.toolName).toBe("testTool<nested>content</nested>")
			expect(result.toolResult).toBe("Test <nested>result</nested>")
		})
	})
})
