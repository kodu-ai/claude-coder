// schema/write_to_file.ts
import { z } from "zod"

/**
 * @tool write_to_file
 * @description Write content to a file at the specified path. This tool has two modes of operation:
 * 1. **Creating a New File**: Provide the full intended content using the `content` parameter. The file will be created if it does not exist.
 * 2. **Modifying an Existing File**: Provide a unified diff (`udiff`) representing the changes to be made. This ensures minimal and precise modifications to existing files.
 * If the file exists, use the `udiff` parameter to describe the changes. If the file doesn't exist, use the `content` parameter to create it with the provided content.
 * Always provide the full content or accurate diffs. Never truncate content or use placeholders.
 * @schema
 * {
 *   path: string;        // The path of the file to write to.
 *   content?: string;    // The complete content to write to the file when creating a new file.
 *   udiff?: string;      // The unified diff representing changes to be made to an existing file.
 * }
 * @example (Creating a new file)
 * ```xml
 * <tool name="write_to_file">
 *   <path>/notes/todo.txt</path>
 *   <content>Buy groceries\nCall Alice</content>
 * </tool>
 * ```
 * @example (Modifying an existing file)
 * ```xml
 * <tool name="write_to_file">
 *   <path>/scripts/setup.sh</path>
 *   <udiff>
 * --- a/scripts/setup.sh
 * +++ b/scripts/setup.sh
 * @@ -1,2 +1,2 @@
 * -echo "Setting up environment"
 * +echo "Initializing environment"
 * </udiff>
 * </tool>
 * ```
 */
const schema = z.object({
	path: z
	  .string()
	  .describe("The path of the file to write to (relative to the current working directory)."),
	content: z
	  .string()
	  .describe(
		"The full content to write to the file when creating a new file. Always provide the complete content without any truncation."
	  )
	  .optional(),
	udiff: z
	  .string()
	  .describe(
		"The unified diff representing the changes to be made to an existing file. This must be formatted correctly, including headers and context lines."
	  )
	  .optional(),
  });

const examples = [
  `<tool name="write_to_file">
  <path>/notes/todo.txt</path>
  <content>Buy groceries\nCall Alice</content>
</tool>`,

  `<tool name="write_to_file">
  <path>/scripts/setup.sh</path>
  <udiff>
--- a/scripts/setup.sh
+++ b/scripts/setup.sh
@@ -1,2 +1,2 @@
-echo "Setting up environment"
+echo "Initializing environment"
</udiff>
</tool>`,

  `<tool name="write_to_file">
  <path>/data/config.json</path>
  <udiff>
--- a/data/config.json
+++ b/data/config.json
@@ -2,7 +2,7 @@
{
  "version": "1.0.0",
- "debug": false,
+ "debug": true,
  "features": ["feature1", "feature2"]
}
</udiff>
</tool>`,
];

export const writeToFileTool = {
  schema: {
    name: "write_to_file",
    schema,
  },
  examples,
};
