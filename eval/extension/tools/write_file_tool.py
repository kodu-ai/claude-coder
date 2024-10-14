import os
import difflib

from eval.extension.tools.base_tool import BaseAgentTool


class WriteFileTool(BaseAgentTool):
    def __init__(self, params: dict, options: dict):
        super().__init__(options)
        self.params = params

    async def execute(self):
        input_data = self.params.get("input", {})
        rel_path = input_data.get("path")
        content = input_data.get("content")
        new_content = content

        if not new_content or not rel_path:
            return await self.on_bad_input_received()

        try:
            absolute_path = os.path.join(self.cwd, rel_path)
            file_exists = os.path.exists(absolute_path)

            original_content = ""
            if file_exists:
                with open(absolute_path, "r", encoding="utf-8") as file:
                    original_content = file.read()

                if original_content.endswith("\n") and not new_content.endswith("\n"):
                    new_content += "\n"

            self.write_file_directly(absolute_path, new_content, file_exists, rel_path)

        except Exception as error:
            return f"Error writing file: {error}"

    async def on_bad_input_received(self):
        return "Error: Missing value for required parameter."

    async def write_file_directly(
        self, absolute_path, new_content, file_exists, rel_path
    ):
        os.makedirs(os.path.dirname(absolute_path), exist_ok=True)
        with open(absolute_path, "w", encoding="utf-8") as file:
            file.write(new_content)

        return f"File written to {rel_path}"

    def create_pretty_patch(self, filename, old_str, new_str):
        diff_result = difflib.unified_diff(
            old_str.splitlines(),
            new_str.splitlines(),
            fromfile=filename,
            tofile=filename,
        )
        return "\n".join(diff_result)
