import { describe, expect, test } from "@jest/globals"
import { detectCodeOmission } from "./detect-code-omission"

describe("detectCodeOmission", () => {
	// Helper function to create clean test output
	const formatTestOutput = (result: ReturnType<typeof detectCodeOmission>) => ({
		hasOmission: result.hasOmission,
		count: result.details.length,
		lines: result.details.map((d) => d.lineNumber),
		keywords: result.details.map((d) => d.keyword),
	})

	// Test empty and null cases
	describe("empty and null cases", () => {
		test("should handle empty original content", () => {
			const result = detectCodeOmission("", "function test() { /* ... */ }")
			expect(result.hasOmission).toBe(false)
		})

		test("should handle empty new content", () => {
			const result = detectCodeOmission("original content", "")
			expect(result.hasOmission).toBe(false)
		})

		test("should handle both empty contents", () => {
			const result = detectCodeOmission("", "")
			expect(result.hasOmission).toBe(false)
		})
	})

	// Test strong omission phrases
	describe("strong omission phrases", () => {
		test("should detect rest of code remains", () => {
			const content = `
                function test() {
                    console.log("Hello");
                    // rest of code remains the same
                }
            `
			const result = detectCodeOmission("original", content)
			expect(formatTestOutput(result)).toEqual({
				hasOmission: true,
				count: 1,
				lines: [4],
				keywords: ["rest of code remains the same"],
			})
		})

		test("should detect previous implementation", () => {
			const content = `
                class Example {
                    // Previous implementation
                    method() {}
                }
            `
			const result = detectCodeOmission("original", content)
			expect(result.hasOmission).toBe(true)
		})
	})

	// Test ellipsis patterns
	describe("ellipsis patterns", () => {
		test("should detect ellipsis in code block", () => {
			const content = `
                function example() {
                    const x = 1;
                    /* ... */
                }
            `
			const result = detectCodeOmission("original", content)
			expect(result.hasOmission).toBe(true)
		})

		test("should ignore ellipsis in string literal", () => {
			const content = `
                function example() {
                    console.log("Loading...");
                }
            `
			const result = detectCodeOmission("original", content)
			expect(result.hasOmission).toBe(false)
		})

		test("should detect structured ellipsis", () => {
			const content = `
                function example() {
                    if (condition) {
                        // Some code
                        { ... }
                    }
                }
            `
			const result = detectCodeOmission("original", content)
			expect(result.hasOmission).toBe(true)
		})
	})

	// Test weak indicators with context
	describe("weak indicators with context", () => {
		test("should detect remains with code context", () => {
			const content = `
                function test() {
                    // Implementation remains
                    doSomething();
                }
            `
			const result = detectCodeOmission("original", content)
			expect(result.hasOmission).toBe(true)
		})

		test("should ignore remains without code context", () => {
			const content = `
                // This remains to be seen
                console.log("test");
            `
			const result = detectCodeOmission("original", content)
			expect(result.hasOmission).toBe(false)
		})
	})

	// Test code block detection
	describe("code block detection", () => {
		test("should detect omission in function", () => {
			const content = `
                function test() {
                    const x = 1;
                    // rest of function unchanged
                }
            `
			const result = detectCodeOmission("original", content)
			expect(result.hasOmission).toBe(true)
		})

		test("should detect omission in class", () => {
			const content = `
                class Example {
                    constructor() {
                        // ... rest of initialization
                    }
                }
            `
			const result = detectCodeOmission("original", content)
			expect(result.hasOmission).toBe(true)
		})

		test("should detect omission in arrow function", () => {
			const content = `
                const handler = () => {
                    // existing implementation
                };
            `
			const result = detectCodeOmission("original", content)
			expect(result.hasOmission).toBe(true)
		})
	})

	// Test false positives
	describe("false positives", () => {
		test("should ignore legitimate comments with remains", () => {
			const content = `
                // TODO: This feature remains to be implemented
                function test() {
                    console.log("Hello");
                }
            `
			const result = detectCodeOmission("original", content)
			expect(result.hasOmission).toBe(false)
		})

		test("should ignore ellipsis in regular text", () => {
			const content = `
                // Loading... please wait
                function test() {
                    console.log("Processing...");
                }
            `
			const result = detectCodeOmission("original", content)
			expect(result.hasOmission).toBe(false)
		})

		test("should ignore rest in variable names", () => {
			const content = `
                function test() {
                    const [...rest] = array;
                    return rest;
                }
            `
			const result = detectCodeOmission("original", content)
			expect(result.hasOmission).toBe(false)
		})
	})

	// Test multiple occurrences
	describe("multiple occurrences", () => {
		test("should detect multiple omissions", () => {
			const content = `
                function test1() {
                    // Previous implementation
                }
                
                function test2() {
                    /* ... */
                }
                
                class Example {
                    // Rest of code remains unchanged
                }
            `
			const result = detectCodeOmission("original", content)
			expect(result.details.length).toBe(3)
		})
	})

	// Test context tracking
	describe("context tracking", () => {
		test("should include correct context in details", () => {
			const content = `
                function calculateTotal() {
                    // Rest of calculation remains same
                }
            `
			const result = detectCodeOmission("original", content)
		})

		test("should track nested contexts", () => {
			const content = `
                class Calculator {
                    calculate() {
                        // Previous implementation
                    }
                }
            `
			const result = detectCodeOmission("original", content)
			expect(result.hasOmission).toBe(true)
		})
	})

	// Test comment variations
	describe("comment variations", () => {
		test("should detect omissions in different comment styles", () => {
			const content = `
                function test() {
                    # Python-style: rest of implementation
                    // C-style: previous implementation
                    /* C-block: existing implementation */
                    /** JSDoc: rest of code remains */
                }
            `
			const result = detectCodeOmission("original", content)
			expect(result.hasOmission).toBe(true)
			expect(result.details.length).toBeGreaterThan(0)
		})
	})

	// Test real-world patterns
	describe("real-world patterns", () => {
		test("should handle real-world truncation patterns", () => {
			const realWorldExamples = [
				`
                function processData() {
                    // Initial setup
                    const data = [];
                    
                    // ... rest of processing logic
                    
                    return data;
                }
                `,
				`
                class ApiClient {
                    constructor() {
                        /* Previous initialization code */
                    }
                    
                    // Implementation remains unchanged from version 1.0
                    makeRequest() {}
                }
                `,
				`
                const handleSubmit = () => {
                    // Form validation
                    validateForm();
                    
                    /* ... submission logic ... */
                    
                    // Success handling
                }
                `,
			]

			realWorldExamples.forEach((example) => {
				const result = detectCodeOmission("original", example)
				expect(result.hasOmission).toBe(true)
			})
		})
	})
})
