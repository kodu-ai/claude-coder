import { z } from "zod";
/**
 * @tool url_screenshot
 * @description Returns a screenshot of a URL provided. This can be used when the user wants to make a design similar to the provided URL.
 * @schema
 * {
 *   url: string; // The URL provided by the user.
 * }
 * @example
 * ```xml
 * <tool name="url_screenshot">
 *   <url>https://www.example.com</url>
 * </tool>
 * ```
 * @example
 * ```xml
 * <tool name="url_screenshot">
 *   <url>https://www.companysite.com/about</url>
 * </tool>`
 * @example
 * ```xml
 * <tool name="url_screenshot">
 *   <url>https://www.designinspiration.com/portfolio</url>
 * </tool>
 * ```
 */
declare const schema: z.ZodObject<{
    url: z.ZodString;
}, "strip", z.ZodTypeAny, {
    url: string;
}, {
    url: string;
}>;
export declare const urlScreenshotTool: {
    schema: {
        name: string;
        schema: z.ZodObject<{
            url: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            url: string;
        }, {
            url: string;
        }>;
    };
    examples: string[];
};
export type UrlScreenshotToolParams = {
    name: "url_screenshot";
    input: z.infer<typeof schema>;
};
export {};
