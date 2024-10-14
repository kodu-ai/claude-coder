class BaseAgentTool:
    def __init__(self, options):
        self.cwd = options["cwd"]
        self.always_allow_read_only = options.get("alwaysAllowReadOnly", False)
        self.always_allow_write_only = options.get("alwaysAllowWriteOnly", False)
        self.kodu_dev = options["koduDev"]
        self.set_running_process_id = options["setRunningProcessId"]

    async def execute(self, params):
        raise NotImplementedError

    async def format_tool_denied_feedback(self, feedback=None):
        return f"The user denied this operation and provided the following feedback:\n<feedback>\n{feedback}\n</feedback>"

    async def format_generic_tool_feedback(self, feedback=None):
        return (
            f"The user denied this operation and provided the following feedback:\n<feedback>\n{feedback}\n</feedback>\n\n"
            + await self.get_potentially_relevant_details()
        )

    async def format_tool_denied(self):
        return "The user denied this operation."

    async def format_tool_result(self, result):
        return result

    async def format_tool_error(self, error=None):
        return f"The tool execution failed with the following error:\n<error>\n{error}\n</error>"

    def format_tool_response_with_images(self, text, images=None):
        if images and len(images) > 0:
            return [text] + images
        else:
            return text

    @property
    def options(self):
        return {
            "cwd": self.cwd,
            "alwaysAllowReadOnly": self.always_allow_read_only,
            "alwaysAllowWriteOnly": self.always_allow_write_only,
            "koduDev": self.kodu_dev,
            "setRunningProcessId": self.set_running_process_id,
        }
