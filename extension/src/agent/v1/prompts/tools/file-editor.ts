import dedent from "dedent"
import { ToolPromptSchema } from "../utils/utils"

export const fileEditorPrompt: ToolPromptSchema = {
	name: "file_editor",
	description:
		"Requests to create, edit or rollback a specific file. This tool is your one-stop shop for interacting with files, from doing precise edits to a file or creating a completely new file or rewriting the complete file content. It also allows you to rollback the last edit you made to a file in case you made a bad edit and need to undo it quickly.",
	parameters: {
		mode: {
			type: "string",
			description:
				"The mode of operation for the file_editor tool. Use 'whole_write' to create a new file or rewrite an existing file, 'edit' to edit an existing file, or 'rollback' to revert the last changes you applied to a file. This will undo the last edit you made to the file.",
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
				"A short and concise commit message that describes the changes made to the file. This is mandatory for 'whole_write' or 'edit' mode and should follow conventional commits standards.",
			required: "Required for 'whole_write' or 'edit' mode",
		},
		kodu_diff: {
			type: "string",
			description:
				"kodu_diff is a specially formatted string that uses standard Git conflict merge format to define the changes to be made to the file. The lines between <<<<<<< HEAD and ======= must match the existing content exactly (letter by letter, including spaces, punctuation, and indentation). The lines between ======= and >>>>>>> mark the final updated version of that section. When you have multiple edits in one file, you can use up to 5 Git conflict blocks in a single kodu_diff string, each block must contain 3 lines of context prior to the replace content.",
			required: "Required for 'edit' mode",
		},
		kodu_content: {
			type: "string",
			description:
				"The full content of the file to be created or rewritten. This replaces the entire file content when mode is 'whole_write', or creates a new file if it does not exist. kodu_content must be the complete implementation without any truncation, placeholders, or omissions.",
			required: "Required for 'whole_write' mode",
		},
	},
	capabilities: [
		"You can use the file_editor tool to make changes to files in the codebase. It lets you update or create files, rewrite files from scratch, and rollback your most recent changes if needed.",
		"When you want to make a precise set of edits, use the 'edit' mode with kodu_diff. Bundle all your related changes in one transaction with multiple Git conflict blocks if necessary.",
		"When you need to revert your last edit, use the 'rollback' mode to revert the file to its previous version.",
	],
	extraDescriptions: dedent`
### Key Principles when using file_editor tool:
1. Gather all changes first, then apply them in one comprehensive transaction to minimize file writes.
2. Always think through your changes inside <thinking></thinking> tags **before** calling the file_editor tool
3. Always make sure to write the most precise changes possible to avoid conflicts or unintended side effects, especially when using 'edit' mode.
### Key Principles for each mode
#### Key Principles for 'whole_write' mode:
- Provide the full content of the file in kodu_content (no omissions or placeholders).
- This overwrites an existing file entirely or creates a new file if it doesn’t exist
#### Key Principles for 'edit' mode:
- Provide the exact changes you want to make in kodu_diff using standard Git conflict merge format blocks.
- Each block should look like:
  <<<<<<< HEAD
  (exact snippet of the latest file content, including 3 lines of context above the replaced lines)
  =======
  (the fully updated content for that snippet)
  >>>>>>> updated
- You must ensure the HEAD content matches exactly with the file’s latest lines content (character-for-character).
- If you are unsure about the exact content, use read_file tool first to verify the file’s latest state.
- **Include at least 3 lines of context** before and after your target lines in each block to ensure robust matches.
- Bundle multiple changes into one kodu_diff if they are part of a single logical update.
- No placeholders in the replacement section; it must be the final updated text
#### CRITICAL RULES WHEN USING 'edit' MODE:
1. CONFIRM YOU HAVE READ THE FILE AND YOU HAVE THE LATEST FILE CONTENT, YOU CAN'T USE FILE_EDITOR WITH 'edit' MODE WITHOUT HAVING THE LATEST FILE CONTENT in memory.
2. Match exactly the latest file content based on the file timestamp that is provided in the tool response, you must have an exact match with the must up to date file content and you must write precise whitespace, indentation and tabs. (use \t and \n and other special characters as needed for exact match with proper indentation, whitespaces and escape characters)
3. Provide a complete final version of each changed snippet in the block after =======.
4. Combine multiple edits into a single call if they’re related, order the edits from top to bottom (as they appear in the file), while making the most precise changes possible. You must provide context lines around each snippet (at least 3 lines to allow for robust matching) only write the snippet content (including whitespace, indentation and special characters) between <<<<<<< HEAD and ======= and between ======= and >>>>>>> updated.
5. Make sure to escape newlines and special characters in the content, this is critical for the tool to work correctly.
6. You must absolutely give special attention while editing python files, as python is sensitive to indentation and whitespace, make sure to match the exact indentation and whitespace, make sure to put extra thought process while editing python files this is absolutely critical step so the edited file works correctly.
`,
	examples: [
		{
			description: "Adding Imports and Removing a Function",
			output: `<thinking>
I need to add a new import (datetime) and rename the existing function old_function to new_function in the same file.
I have the latest file content, which includes the following lines:

import os
print("line A")
print("line B")
print("line C")

def old_function():
    print("I am old!")


def some_other_function():
    pass

I will create two Git conflict blocks:
1. One block to add the import datetime (with 3 lines of context).
2. Another block to rename old_function to new_function (also with 3 lines of context).
</thinking>

<kodu_action><file_editor><path>myapp/utility.py</path><mode>edit</mode><commit_message>feat(utility): add datetime import and rename old_function to new_function</commit_message><kodu_diff>
<<<<<<< HEAD
import os
print("line A")
print("line B")
print("line C")
=======
import os
import datetime
print("line A")
print("line B")
print("line C")
>>>>>>> updated
<<<<<<< HEAD
print("line B")
print("line C")

def old_function():
    print("I am old!")
=======
print("line B")
print("line C")

def new_function():
    print("I am old!")
>>>>>>> updated
</kodu_diff>
</file_editor></kodu_action>
`,
		},
		{
			description: "Multiple Related Changes in One Go",
			output: `<thinking>
...
"I need to do multiple edits in a single file. First, update a function call from 'return str(factorial(n))' to 'return str(math.factorial(n))'. Also, add a new logging line inside another function. Both changes can be done with Git conflict–style blocks in one edit call."
...
</thinking>

<file_editor>
<path>mathweb/flask/app.py</path>
<mode>edit</mode>
<commit_message>fix(math): update factorial call to use math library and add debug log</commit_message>
<kodu_diff>
<<<<<<< HEAD
# Contextual code for better matching
def process_number(n):
    result = n * 2
    return str(factorial(n))

# More context if necessary
def another_function_call():
    pass
=======
# Contextual code for better matching
def process_number(n):
    result = n * 2
    return str(math.factorial(n))

# More context if necessary
def another_function_call():
    # Adding a debug log line
    print("another_function_call invoked")
    pass
>>>>>>> updated
</kodu_diff>
</file_editor>`,
		},
		{
			description: "Complex Multi-Hunk Update",
			output: `<thinking>
...
"I have a file where I need to add a new import, update an existing export, and add a new property to a component's state. I will do it all at once using multiple Git conflict blocks i will order the blocks from top to bottom and use the content precisely."
...
</thinking>

<file_editor>
<path>main.py</path>
<mode>edit</mode>
<commit_message>feat(ui): add auth import, update export, and add extraInfo state property</commit_message>
<kodu_diff>
<<<<<<< HEAD
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '~/components/ui/dialog';
=======
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '~/components/ui/dialog';
import { useAuth } from '~/hooks/useAuth';
>>>>>>> updated
<<<<<<< HEAD
export function AddSubscriptionModal({
  isOpen,
  onClose,
}: AddSubscriptionModalProps) {
  const addSubscription = useSubscriptionStore(
    (state) => state.addSubscription
  );
=======
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
>>>>>>> updated
</kodu_diff>
</file_editor>`,
		},
		{
			description: "Creating a New File or Rewriting an Existing File",
			output: `<thinking>
...
"I need to create a new React component for showing a user profile. I will use 'whole_write' mode and put the complete content in kodu_content. This will create or overwrite the file."
...
</thinking>

<file_editor>
<path>src/components/UserProfile.tsx</path>
<mode>whole_write</mode>
<commit_message>feat(components): create UserProfile component</commit_message>
<kodu_content>
// Full content of the UserProfile component goes here...
</kodu_content>
</file_editor>`,
		},
		{
			description: "Rollback last changes you made to a file",
			output: `<thinking>
...
"I have identified that the last changes I made to the file caused a regression. I want to rollback to the previous version using 'rollback' mode."
...
</thinking>

<file_editor>
<path>src/components/UserProfile.tsx</path>
<mode>rollback</mode>
</file_editor>`,
		},
	],
}
