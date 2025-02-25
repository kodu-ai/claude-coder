import dedent from "dedent"
import { ToolPromptSchema } from "../utils/utils"

export const fileEditorPrompt: ToolPromptSchema = {
	name: "file_editor",
	description:
		"Requests to create or edit a specific file. Edit mode for precise changes, whole_write mode for full content replacement",
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
			description: "The relative path (from {{cwd}}) of the file to edit, create, or roll back.",
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
		"Use 'edit' with kodu_diff, it will alow you to make precise changes to the file using Git conflict format (up to 5 blocks per call).",
	],
	extraDescriptions: dedent`
    ### Key Principles When Using file_editor
    
    1. **Gather all changes first**: Apply them in a single transaction to reduce file writes.
    2. **Think carefully before calling the tool**: Plan your edits in <thinking>...</thinking> to confirm exactly what lines to change.
    3. **No placeholders** in the final snippets for "edit" or "whole_write" modes. Provide exact text.
	4. **Think carefully about the file content and file type**: You should think carefully about the type of file we are editing and match the editing accordingly.
	For example for typescript files, you should be careful about the syntax and indentatio and typing.
	For python files, you should be careful about the syntax and indentation, python is very sensitive to indentation and whitespace and can break if misaligned or misused.
	For react files, you should be careful about the syntax and indentation and the JSX syntax, remember to close all tags and use the correct syntax, don't forget the best practices and the react hooks.
	You should follow this idea for any programming language or file type you are editing, first think about the file type and the syntax and the best practices and then start editing.
    
    ### Key Principles per Mode
    
    **'whole_write' Mode**:
    - Provide the file’s full content in 'kodu_content'. This overwrites an existing file entirely or creates a new file.
    - Must include a valid commit_message.

    **'edit' Mode**:
    - Provide the precise changes via 'kodu_diff' using standard Git conflict markers, up to 5 blocks per call, in top-to-bottom file order while maintaining indentation and whitespace.
    - Each block must have at least 3 lines of exact context before (and ideally after) the snippet being replaced.
    - The content in <<<<<<< HEAD ... ======= must exactly match the file’s current lines.
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
	6. You should try to aim for a precise edit while using only the nessesary lines to be changed, find the code block boundaries and edit only the needed lines.
  `,
	examples: [
		{
			description: "Adding Imports and Removing a Function",
			thinking: `<thinking>I have the latest file content... I will add an import and rename a function using 2 conflict blocks.</thinking>`,
			output: `<file_editor>
<path>myapp/utility.py</path>
<mode>edit</mode>
<commit_message>feat(utility): add import and rename function</commit_message>
<kodu_diff>
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
</kodu_diff>
</file_editor>`,
		},
		{
			description: "Multiple Related Changes in One Go",
			thinking: `<thinking>I must update a function call and add logging in the same file with 1 conflict block.</thinking>`,
			output: `<file_editor>
<path>mathweb/flask/app.py</path>
<mode>edit</mode>
<commit_message>fix(math): update factorial call and add debug log</commit_message>
<kodu_diff>
<<<<<<< HEAD
(3 lines of exact context)
=======
(3 lines of exact context + updated function call + added debug log)
>>>>>>> updated
</kodu_diff>
</file_editor>`,
		},
		{
			description: "Creating a New File or Rewriting an Existing File",
			thinking: `<thinking>I need to create or overwrite a React component file with entire content.</thinking>`,
			output: `<file_editor>
<path>src/components/UserProfile.tsx</path>
<mode>whole_write</mode>
<commit_message>feat(components): create UserProfile component</commit_message>
<kodu_content>
// Full file content here...
</kodu_content>
</file_editor>`,
		},
	],
}
