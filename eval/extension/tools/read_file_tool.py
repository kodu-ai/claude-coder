import os
import json
import traceback

from eval.extension.tools.base_tool import BaseAgentTool


class ReadFileTool(BaseAgentTool):
    def __init__(self, params, options):
        super().__init__(options)
        self.params = params

    async def execute(self):
        input_data = self.params.get("input", {})
        rel_path = input_data.get("path")

        if rel_path is None:
            return """
            Error: Missing value for required parameter 'path'. Please retry with a complete response.
            An example of a good readFile tool call is:
            {
                "tool": "read_file",
                "path": "path/to/file.txt"
            }
            Please try again with the correct path, you are not allowed to read files without a path.
            """

        try:
            absolute_path = os.path.join(self.cwd, rel_path)

            # Simulating extractTextFromFile function from the original code
            content = await self.extract_text_from_file(absolute_path)

            message = json.dumps(
                {
                    "tool": "readFile",
                    "path": self.get_readable_path(rel_path, self.cwd),
                    "content": content,
                }
            )

            # If read-only mode is allowed, return the file content directly
            if self.always_allow_read_only:
                return content
            else:
                # No user prompt or decision, just return content
                return content

        except Exception as error:
            error_string = f"""
            Error reading file: {traceback.format_exc()}
            An example of a good readFile tool call is:
            {{
                "tool": "read_file",
                "path": "path/to/file.txt"
            }}
            Please try again with the correct path, you are not allowed to read files without a path.
            """
            return error_string

    async def extract_text_from_file(self, file_path):
        """Extract text from a file."""
        try:
            with open(file_path, "r", encoding="utf-8") as file:
                content = file.read()
            return content
        except FileNotFoundError:
            return "File not found"
        except Exception as e:
            return f"Error extracting text: {str(e)}"

    def get_readable_path(self, rel_path, cwd):
        """Generate a readable path relative to the working directory."""
        return os.path.relpath(os.path.join(cwd, rel_path), start=cwd)

    def format_tool_response(self, text, images=None):
        """Simulate formatting a tool response."""
        return text if not images else f"{text} with images: {images}"

    def format_generic_tool_feedback(self, feedback):
        """Simulate formatting generic feedback."""
        return f"Feedback: {feedback}"


# Example usage
options = {
    "cwd": "/path/to/directory",
    "alwaysAllowReadOnly": False,
    "alwaysAllowWriteOnly": False,
    "koduDev": None,
    "setRunningProcessId": None,
}
params = {"input": {"path": "example.txt"}}

tool = ReadFileTool(params, options)
result = tool.execute()
