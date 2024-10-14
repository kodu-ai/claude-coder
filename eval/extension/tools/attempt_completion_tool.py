from eval.extension.tools.base_tool import BaseAgentTool
from eval.extension.tools.execute_command_tool import ExecuteCommandTool
from utils import format_tool_response


class AttemptCompletionTool(BaseAgentTool):
    def __init__(self, params, options):
        super().__init__(options)
        self.params = params

    async def execute(self):
        input_data = self.params.get("input", {})
        result = input_data.get("result")
        command = input_data.get("command")

        if result is None:
            return """
            Error: Missing value for required parameter 'result'. Please retry with complete response.
            An example of a good attemptCompletion tool call is:
            {
                "tool": "attempt_completion",
                "result": "result to attempt completion with"
            }
            """

        result_to_send = result
        if command:
            # Skipping the say method and directly running the command
            execute_command_params = {
                **self.params,
                "returnEmptyStringOnSuccess": True,
            }
            command_result = await ExecuteCommandTool(
                execute_command_params, self.options
            ).execute()

            if command_result:
                return command_result

            result_to_send = ""

        # Skipping the ask method, assuming approval
        return ""

    def format_tool_response(self, text, images=None):
        """Simulates formatting a tool response."""
        return format_tool_response(text, images)
