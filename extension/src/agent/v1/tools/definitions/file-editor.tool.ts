import { z } from "zod"
import dedent from "dedent"
import { defineToolCallFormat, generateToolCallExamples } from "./tool-call-template"

/**
 * Unified definition for file_editor tool
 * Combines schema, prompt, and type definitions in one place
 * Uses consistent calling format
 */

/**
 * File editor modes
 */
export const FileEditorModes = ["edit", "whole_write", "rollback"] as const

/**
 * ZOD Schema Definition
 */
export const schema = z.object({
    path: z.string().describe("The path of the file to write to (relative to the current working directory)."),
    mode: z.preprocess((val) => {
        // Ensure that val is a string before passing it to the enum validator
        if (typeof val === "string") {
            return val
        }
        return undefined // This will fail the enum check if not a string
    }, z.enum(FileEditorModes).describe("The mode of the file editor tool.")),
    commit_message: z.string().optional().describe("The commit message to use when committing changes to the file."),
    kodu_content: z
        .string()
        .describe(
            "The full content to write to the file when creating a new file. Always provide the complete content without any truncation."
        )
        .optional(),
    kodu_diff: z
        .string()
        .describe(
            "The `SEARCH/REPLACE` blocks representing the changes to be made to an existing file. These blocks must be formatted correctly, matching exact existing content for `SEARCH` and precise modifications for `REPLACE`."
        )
        .optional(),
})

/**
 * Type definitions derived from schema
 */
export type FileEditorInput = z.infer<typeof schema>

export type FileEditorToolParams = {
    name: "file_editor"
    input: FileEditorInput
}

/**
 * Example parameter values for tool calls
 */
const exampleParams = [
    { 
        path: "myapp/utility.py",
        mode: "edit",
        commit_message: "feat(utility): add import and rename function",
        kodu_diff: dedent`
        <<<<<<< HEAD
        (3 lines of exact context)
        =======
        (3 lines of exact context + new import + updated function name)
        >>>>>>> updated
        <<<<<<< HEAD
        (3 lines of exact context for second edit)
        =======
        (3 lines of exact context for second edit with replaced lines)
        >>>>>>> updated
        `
    },
    {
        path: "src/components/UserProfile.tsx",
        mode: "whole_write",
        commit_message: "feat(components): create UserProfile component",
        kodu_content: "// Full file content here..."
    }
]

/**
 * Generate consistent example tool calls
 */
const exampleCalls = generateToolCallExamples("file_editor", exampleParams)

/**
 * Prompt definition for LLM consumption
 * Based on prompts/tools/file-editor.ts but with unified calling format
 */
export const promptDefinition = {
    name: "file_editor",
    description: "Requests to create or edit a specific file. Edit mode for precise changes, whole_write mode for full content replacement",
    parameters: {
        mode: {
            type: "string",
            description: dedent`
            The operation mode of the file_editor tool:
            - "whole_write": create or completely rewrite a file.
            - "edit": make precise edits to an existing file.`,
            required: true,
        },
        path: {
            type: "string",
            description: "The relative path of the file to edit, create, or roll back.",
            required: true,
        },
        commit_message: {
            type: "string",
            description: dedent`
            A short, concise commit message describing the change. 
            Required if "mode" is "whole_write" or "edit".
            Should follow conventional commits standards (e.g., "feat:", "fix:", etc.).
            `,
            required: 'Required for "whole_write" or "edit" mode',
        },
        kodu_diff: {
            type: "string",
            description: dedent`it is required to make a precise kodu_diff if "mode" is "edit".
            Must use standard Git conflict merge format as follows:
            <<<<<<< HEAD
            (the exact lines from the file, including 3 lines of context before and 3 lines of context after the replaced lines)
            =======
            (the new lines that will replace the old ones; must be final, no placeholders)
            >>>>>>> updated
            You may include up to 5 such blocks if multiple edits are needed, ordered from the top of the file to the bottom of the file (line numbers). Each block must have at least 3 lines of unchanged context before the snippet you want to replace. 
            The content between <<<<<<< HEAD and ======= must exactly match the file's current content, including whitespace and indentation. The content between ======= and >>>>>>> updated is the fully updated version.
            `,
            required: 'Required for "edit" mode',
        },
        kodu_content: {
            type: "string",
            description: dedent`
            Required if "mode" is "whole_write". This must be the complete, final content of the file with no placeholders or omissions. It overwrites the file if it already exists or creates a new one if it does not.`,
            required: 'Required for "whole_write" mode',
        },
    },
    capabilities: [
        "Use 'whole_write' to replace the entire file content or create a new file.",
        "Use 'edit' with kodu_diff, it will allow you to make precise changes to the file using Git conflict format (up to 5 blocks per call)."
    ],
    extraDescriptions: dedent`
    ### Key Principles When Using file_editor
    
    1. **Gather all changes first**: Apply them in a single transaction to reduce file writes.
    2. **Think carefully before calling the tool**: Plan your edits to confirm exactly what lines to change.
    3. **No placeholders** in the final snippets for "edit" or "whole_write" modes. Provide exact text.
    4. **Think carefully about the file content and file type**: You should think carefully about the type of file we are editing and match the editing accordingly.
    For example for typescript files, you should be careful about the syntax and indentation and typing.
    For python files, you should be careful about the syntax and indentation, python is very sensitive to indentation and whitespace and can break if misaligned or misused.
    For react files, you should be careful about the syntax and indentation and the JSX syntax, remember to close all tags and use the correct syntax, don't forget the best practices and the react hooks.
    You should follow this idea for any programming language or file type you are editing, first think about the file type and the syntax and the best practices and then start editing.
    
    ### Key Principles per Mode
    
    **'whole_write' Mode**:
    - Provide the file's full content in 'kodu_content'. This overwrites an existing file entirely or creates a new file.
    - Must include a valid commit_message.

    **'edit' Mode**:
    - Provide the precise changes via 'kodu_diff' using standard Git conflict markers, up to 5 blocks per call, in top-to-bottom file order while maintaining indentation and whitespace.
    - Each block must have at least 3 lines of exact context before (and ideally after) the snippet being replaced.
    - The content in <<<<<<< HEAD ... ======= must exactly match the file's current lines.
    - The content in ======= ... >>>>>>> updated is your fully updated replacement with no placeholders.
    - If multiple snippets need editing, combine them into one 'kodu_diff' string with multiple blocks, in top-to-bottom file order.
    - Must include a valid commit_message.
    - Must use precise changes and find the code block boundaries and edit only the needed lines.

    **CRITICAL RULES FOR 'edit' MODE**:
    1. You must have read the file (latest version) before editing. No guesswork; the HEAD section must match character-for-character.
    2. Maintain indentation and whitespace exactly. Python or similarly sensitive files can break if misaligned.
    3. Provide at least 3 lines of unchanged context around each replaced snippet.
    4. Write the changes from top to bottom, ensuring the blocks appear in the same order as they do in the file.
    5. Escape special characters (\t, \n, etc.) properly if needed.
    6. You should try to aim for a precise edit while using only the necessary lines to be changed, find the code block boundaries and edit only the needed lines.
    `,
    examples: exampleCalls.map((call, i) => ({
        description: i === 0 ? "Editing a file with precise changes" : "Creating a new file or overwriting an existing file",
        output: call
    })),
    ...defineToolCallFormat("file_editor")
}

/**
 * Full tool definition - exports everything needed in one place
 */
export const fileEditorTool = {
    name: "file_editor",
    schema,
    prompt: promptDefinition,
    examples: promptDefinition.examples,
    callFormat: promptDefinition.callFormat
}