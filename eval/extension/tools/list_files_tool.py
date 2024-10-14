import os
import traceback
from eval.extension.tools.base_tool import BaseAgentTool

# Constants for file limits
LIST_FILES_LIMIT = 100  # Example value for the maximum number of files to return


class ListFilesTool(BaseAgentTool):
    def __init__(self, params, options):
        super().__init__(options)
        self.params = params

    async def execute(self):
        input_data = self.params.get("input", {})
        rel_dir_path = input_data.get("path")
        recursive_raw = input_data.get("recursive", "false")

        if rel_dir_path is None:
            return """
            Error: Missing value for required parameter 'path'. Please retry with complete response.
            A good example of a listFiles tool call is:
            {
                "tool": "list_files",
                "path": "path/to/directory"
            }
            Please try again with the correct path, you are not allowed to list files without a path.
            """

        try:
            recursive = recursive_raw.lower() == "true"
            absolute_path = os.path.abspath(os.path.join(self.cwd, rel_dir_path))
            files = await self.list_files(absolute_path, recursive)
            result = self.format_files_list(absolute_path, files)

            # If read-only mode is allowed, return the file list
            if self.always_allow_read_only:
                return result
            else:
                # No user prompt, returning the file list directly
                return result

        except Exception as error:
            error_string = (
                f"Error listing files and directories: {traceback.format_exc()}"
            )
            return error_string

    async def list_files(self, absolute_path, recursive):
        """Recursively list files in a directory."""
        file_list = []
        if recursive:
            for root, dirs, files in os.walk(absolute_path):
                for file_name in files:
                    file_list.append(os.path.join(root, file_name))
        else:
            try:
                file_list = [
                    os.path.join(absolute_path, f)
                    for f in os.listdir(absolute_path)
                    if os.path.isfile(os.path.join(absolute_path, f))
                ]
            except PermissionError:
                file_list = []
        return file_list

    def format_files_list(self, absolute_path, files):
        """Format the file list for output."""
        sorted_files = sorted(
            [os.path.relpath(file, absolute_path) for file in files],
            key=lambda x: (x.count(os.path.sep), x.lower()),
        )

        # Handling file truncation for large lists
        if len(sorted_files) >= LIST_FILES_LIMIT:
            truncated_list = "\n".join(sorted_files[:LIST_FILES_LIMIT])
            return f"{truncated_list}\n\n(Truncated at {LIST_FILES_LIMIT} results. Try listing files in subdirectories if you need to explore further.)"
        elif len(sorted_files) == 0:
            return (
                "No files found or you do not have permission to view this directory."
            )
        else:
            return "\n".join(sorted_files)


# Example usage (You can modify or remove this for your actual implementation)
options = {
    "cwd": "/path/to/directory",
    "alwaysAllowReadOnly": True,
    "alwaysAllowWriteOnly": False,
    "koduDev": None,
    "setRunningProcessId": None,
}
params = {"input": {"path": "example_directory", "recursive": "false"}}

tool = ListFilesTool(params, options)
result = tool.execute()
