import dedent from "dedent"
import { ToolPromptSchema } from "../utils/utils"

export const fileEditorPrompt: ToolPromptSchema = {
	name: "file_editor",
	description:
		"Requests to create, edit or rollback a specifc file. This tool is your one stop shop for interacting with files, from doing precise edits to a file or creating a completely new file or rewritting the complete file content to a new one, this tool can do it all. It also allows you to rollback to rollback the last edit you made to a file incase you made a bad edit and need to undo it quickly.",
	parameters: {
		mode: {
			type: "string",
			description:
				"The mode of operation for the file_editor tool. Use 'whole_write' to create a new file or rewrite an existing file, 'edit' to edit an existing file content or 'rollback' to revert the last changes you applied to a file, this will undo the last edit you made to the file.",
			required: true,
		},
		path: {
			type: "string",
			description: `The path of the file to edit (relative to {{cwd}})`,
			required: true,
		},
		commit_message: {
			type: "string",
			description:
				"A short and concise commit message that describes the changes made to the file. This is mandatory to ensure that the changes are well documented and can be tracked in the version control system, it should follow conventional commits standards.",
			required: "Required for 'whole_write' or 'edit' mode",
		},
		kodu_diff: {
			type: "string",
			description:
				"kodu_diff is a specially formatted string that uses SEARCH and REPLACE blocks to define the changes to be made in the file. The SEARCH block should match the existing content exactly letter by letter, space by space and each punctuation mark and exact match is required. The REPLACE block should contain the final, full updated version of that section, without placeholders or incomplete code.",
			required: "Required for 'edit' mode",
		},
		kodu_content: {
			type: "string",
			description:
				"The full content of the file to be created or rewritten. This should be the complete content of the file, not just the changes, this will replace the whole file content with the content provided, and if this is a new file it will create the file with the content provided and create the needed directories if they don't exist. kodu_content must be the complete implemention without any single truncation or omitted content, it must be the full content of the file.",
			required: "Required for 'whole_write' mode",
		},
	},
	capabilities: [
		"You can use the file_editor tool to make changes to files in the codebase, it's an extremely important piece of your toolset that let you update edit file, create new file, rewrite existing file from scratch, understand previous edits you made to a file and rollback to one of your prior edits in case you caused a regression or made a bad edit / write.",
		"You can use the file_editor tool on 'edit' mode to make precise changes to a file, this is useful when you want to make specific updates to a file without rewriting the entire content you should provide the most accurate and exact changes you want to make to the file content and bundle them into one singular tool call with multiple SEARCH/REPLACE blocks.",
		"You can use the file_editor tool on 'rollback' mode to rollback to a previous version of the file before the last edit was applied, this is useful when you want to undo the last changes you made to a file.",
	],
	extraDescriptions: dedent`
		### Key Principles when using file_editor tool:
		Always gather all changes first, then apply them in one comprehensive transaction, you want to minimize the number of file writes to avoid conflicts and ensure consistency.
		Always before calling file_editor tool, spend time reasoning about your changes inside <thinking></thinking> tags this is mandatory to ensure you have a clear plan and you have thought about all the changes you want to make.
		### Key Principles for each mode
		#### Key Principles for 'whole_write' mode:
		Always provide the full content of the file to be created or rewritten in the kodu_content parameter.
		Never omit any part of the content, always provide the full content.
		Never use placeholders or incomplete code, always provide the full content.
		#### Key Principles for 'edit' mode:
		Always provide the full required updates in the kodu_diff parameter, you should write as many necessary SEARCH/REPLACE blocks in one transaction, you should understand your previous changes and the new changes you want to make and make sure it progresses the file content in the right direction to complete the user task.
		kodu_diff SEARCH and REPLACE must follow a strict FORMAT OF SEARCH\nexact match letter by letter, line by line of the desired content to replace\n=======\nREPLACE\nexact match letter by letter, line by line of the new content\n, this is mandatory to ensure the tool can make the correct changes to the file content.
		You must first identify the exact lines and their content that you want to replace for every change you want to make (every block).
		You must provide at least 3 lines of context before and after your search block to ensure a robust match (this provides the tool with enough context to make the correct changes).
		You must plan as many related edits together and execute one tool call with all the changes to ensure consistency and avoid conflicts.
		Each SEARCH block must match the existing content exactly, including whitespace and punctuation.
		Each REPLACE block should contain the final, full updated version of that section, without placeholders or incomplete code, it should be the content based on you prior thinking and reasoning.
		You must use multiple SEARCH/REPLACE pairs in the same call if you need to make multiple related changes to the same file, this is the preferred way to make changes to a file instead of calling file_editor tool many times.
		If unsure about what to replace, read the file first using the read_file tool and confirm the exact content, if you are failing to match the content exactly, you should re-read the file content and try again before falling back to whole_write mode.
		You must think out loud before calling file_editor tool this means inside <thinking></thinking> tags, articulate your changeset plan with helpful questions like: What lines are you changing? Why are you changing them? Show a small snippet of the before/after changes if helpful. Confirm that you have all the context and that the SEARCH block matches exactly.
		#### CRITICAL RULES WHEN USING file_editor WITH EDIT MODE. (WHEN USING SEARCH/REPLACE BLOCKS):
		Read the File if Needed: Ensure you have the most recent file content.
		Match Exactly: The SEARCH section must be character-for-character identical to the file's current content, including spacing and indentation.
		No Placeholders: Provide fully updated content in the REPLACE section.
		Multiple Blocks: If you have several related changes, bundle them in one call with multiple SEARCH/REPLACE pairs.
		Context Lines: Include at least 3 lines of context before your target line to ensure a robust match. Add a few lines after as well if possible
		`,
	examples: [
		{
			description: "Adding Imports and Removing a Function",
			output: `<thinking>
....
"I need to add an import statement and remove an outdated function \`factorial\`. The file currently imports Flask only, but I need to import \`math\` as well. Also, I want to remove the \`factorial\` function entirely. I have at least 3 lines of context around these changes. I'll do both changes in one file_editor_call call using edit mode."
....
</thinking>

<file_editor>
<path>mathweb/flask/app.py</path>
<mode>edit</mode>
<commit_message>refactor(math): add math import and remove factorial function</commit_message>
<kodu_diff>
SEARCH
from flask import Flask
# Additional context lines for matching
def my_function():
    pass

class Example:
    def __init__(self):
        pass
=======
REPLACE
import math
from flask import Flask
# Additional context lines for matching
def my_function():
    pass

class Example:
    def __init__(self):
        pass
======= 
SEARCH
def factorial(n):
    "compute factorial"

    if n == 0:
        return 1
    else:
        return n * factorial(n-1)

# Context lines for better match
def another_function():
    print("This is a test")
=======
REPLACE
# Context lines for better match
def another_function():
    print("This is a test")
</kodu_diff>
</file_editor>`,
		},
		{
			description: "Multiple Related Changes in One Go",
			output: `<thinking>
....
"I need to do multiple edits in a single file. First, I must update a function call from \`return str(factorial(n))\` to \`return str(math.factorial(n))\`. Also, I must add a new logging line inside another function. I have the full content and I ensure I pick a large enough context around each change. Both changes can be bundled into one file_editor tool call using edit mode."
....
</thinking>

<file_editor>
<path>mathweb/flask/app.py</path>
<mode>edit</mode>
<commit_message>fix(math): update factorial call to use math library and add debug log</commit_message>
<kodu_diff>
SEARCH
# Contextual code for better matching
def process_number(n):
    result = n * 2
    return str(factorial(n))

# More context if necessary
def another_function_call():
    pass
=======
REPLACE
# Contextual code for better matching
def process_number(n):
    result = n * 2
    return str(math.factorial(n))

# More context if necessary
def another_function_call():
    # Adding a debug log line
    print("another_function_call invoked")
    pass
</kodu_diff>
</file_editor>`,
		},
		{
			description: "Complex Multi-Hunk Update",
			output: `<thinking>
....
"I have a file where I need to add a new import, update an existing export, and add a new property to a component's state. I will perform all these changes at once. I'll carefully choose unique context lines and ensure each SEARCH block matches exactly what's in the file currently. This reduces the risk of mismatching. let me call the file_editor tool with all the changes bundled together using edit mode."
....
</thinking>

<file_editor>
<path>main.py</path>
<mode>edit</mode>
<commit_message>feat(ui): add auth import, update export, and add extraInfo state property</commit_message>
<kodu_diff>
SEARCH
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '~/components/ui/dialog';
======= 
REPLACE
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '~/components/ui/dialog';
import { useAuth } from '~/hooks/useAuth';
=======
SEARCH
export function AddSubscriptionModal({
  isOpen,
  onClose,
}: AddSubscriptionModalProps) {
  const addSubscription = useSubscriptionStore(
    (state) => state.addSubscription
  );
=======
REPLACE
export function AddSubscriptionModal({
  isOpen,
  onClose,
}: AddSubscriptionModalProps) {
  const addSubscription = useSubscriptionStore(
    (state) => state.addSubscription
  );
  const auth = useAuth(); // new line added

  // Also adding a new property to the component's internal state
  const [extraInfo, setExtraInfo] = useState(null);
</kodu_diff>
</file_editor>`,
		},
		{
			description: "Creating a New File or Rewriting an Existing File",
			output: `<thinking>
....
"I need to create a new react component for showing a user profile. I will create a new file called \`UserProfile.tsx\` and write the full content of the component in it. I will use the file_editor tool in the whole_write mode to create the file with the full content without any truncation."
....
</thinking>

<file_editor>
<path>src/components/UserProfile.tsx</path>
<mode>whole_write</mode>
<commit_message>feat(components): create UserProfile component ...</commit_message>
<kodu_content>... full content of the UserProfile component ...</kodu_content>
</file_editor>`,
		},
		{
			description: "Rollback last changes you made to a file",
			output: `<thinking>
....
"I have identified that the last changes i made to the file caused a regression, i want to rollback to the previous version of the file, i will use the file_editor tool in the rollback mode to rollback to the previous version of the file before the edit was applied."
....
</thinking>
<file_editor>
<path>src/components/UserProfile.tsx</path>
<mode>rollback</mode>
</file_editor>`,
		},
	],
}
