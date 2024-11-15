// schema/write_to_file.ts
import { z } from "zod"

/**
 * @tool write_to_file
 * @description Write content to a file at the specified path. This tool has two modes of operation:
 * 1. **Creating a New File**: Provide the full intended content using the `content` parameter. The file will be created if it does not exist.
 * 2. **Modifying an Existing File**: Provide changes using `SEARCH/REPLACE` blocks to precisely describe modifications to existing files.
 * If the file exists, use the `diff` parameter to describe the changes. If the file doesn't exist, use the `content` parameter to create it with the provided content.
 * Always provide the full content or accurate changes using `SEARCH/REPLACE` blocks. Never truncate content or use placeholders.
 * @schema
 * {
 *   path: string;     // The path of the file to write to.
 *   content?: string; // The complete content to write to the file when creating a new file.
 *   diff?: string;    // The `SEARCH/REPLACE` blocks representing changes to be made to an existing file.
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
 *   <diff>
 * <scripts/setup.sh
 * <<<<<<< SEARCH
 * echo "Setting up environment"
 * =======
 * echo "Initializing environment"
 * >>>>>>> REPLACE
 * </diff>
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
  diff: z
    .string()
    .describe(
      "The `SEARCH/REPLACE` blocks representing the changes to be made to an existing file. These blocks must be formatted correctly, matching exact existing content for `SEARCH` and precise modifications for `REPLACE`."
    )
    .optional(),
});

const examples = [
  `<write_to_file>
  <path>/notes/todo.txt</path>
  <content>Buy groceries\nCall Alice</content>
</write_to_file>`,

  `<write_to_file>
  <path>/scripts/setup.sh</path>
  <diff>
SEARCH
echo "Setting up environment"
=======
REPLACE
echo "Initializing environment"
</diff>
</write_to_file>`,

  `<write_to_file>
  <path>/data/config.json</path>
  <diff>
SEARCH
{
  "version": "1.0.0",
  "debug": false,
  "features": ["feature1", "feature2"]
}
=======
REPLACE
{
  "version": "1.0.0",
  "debug": true,
  "features": ["feature1", "feature2"]
}
</diff>
</write_to_file>`,

  `<write_to_file>
  <path>src/example.js</path>
  <diff>
SEARCH
const x = 42;
=======
REPLACE
const x = 100; // Modified value for testing
</diff>
</write_to_file>`,

  `<write_to_file>
  <path>mathweb/flask/app.py</path>
  <diff>
SEARCH
from flask import Flask
=======
REPLACE
import math
from flask import Flask
</diff>
</write_to_file>`,

  `<write_to_file>
  <path>mathweb/flask/app.py</path>
  <diff>
SEARCH
def factorial(n):
    "compute factorial"

    if n == 0:
        return 1
    else:
        return n * factorial(n-1)

=======
REPLACE

</diff>
</write_to_file>`,

  `<write_to_file>
  <path>mathweb/flask/app.py</path>
  <diff>
SEARCH
    return str(factorial(n))
=======
REPLACE
    return str(math.factorial(n))
</diff>
</write_to_file>`,

  `<write_to_file>
  <path>hello.py</path>
  <content>
def hello():
    "print a greeting"

    print("hello")
</content>
</write_to_file>`,

  `<write_to_file>
  <path>main.py</path>
  <diff>
SEARCH
def hello():
    "print a greeting"

    print("hello")
=======
REPLACE
from hello import hello
</diff>
</write_to_file>`
];


export const writeToFileTool = {
  schema: {
    name: "write_to_file",
    schema,
  },
  examples,
};
