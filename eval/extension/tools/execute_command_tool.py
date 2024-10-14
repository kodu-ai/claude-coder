import subprocess
from eval.extension.tools.base_tool import BaseAgentTool


class ExecuteCommandTool(BaseAgentTool):
    def __init__(self, params, options):
        super().__init__(options)
        self.params = params

    async def execute(self):
        input_data = self.params.get("input", {})
        command = input_data.get("command")

        if not command:
            return """
            Error: Missing value for required parameter 'command'. Please retry with complete response.
            An example of a good executeCommand tool call is:
            {
                "tool": "execute_command",
                "command": "command to execute"
            }
            Please try again with the correct command, you are not allowed to execute commands without a command.
            """

        try:
            result = subprocess.run(
                command,
                shell=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                cwd=self.cwd,
            )

            # Combine stdout and stderr
            output = result.stdout.strip()
            error_output = result.stderr.strip()

            if error_output:
                return f"Command failed with the following error:\n{error_output}"

            if output:
                return f"Command executed. Output:\n{output}"
            else:
                return "Command executed but produced no output."

        except Exception as error:
            return f"Error executing command: {str(error)}"


# Example usage (You can modify or remove this for your actual implementation)
options = {
    "cwd": "/path/to/directory",
    "alwaysAllowReadOnly": False,
    "alwaysAllowWriteOnly": False,
    "koduDev": None,
    "setRunningProcessId": None,
}
params = {"input": {"command": "ls"}}

tool = ExecuteCommandTool(params, options)
result = tool.execute()
