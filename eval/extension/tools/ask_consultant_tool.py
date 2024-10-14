from typing import Dict
from eval.extension.tools.base_tool import BaseAgentTool
from eval.extension.providers.api_provider import ApiProvider


class AskConsultantTool(BaseAgentTool):
    def __init__(self, params: Dict, options: Dict):
        super().__init__(options)
        self.params = params
        self.kodu_dev = options.get("koduDev")

    async def execute(self):
        query = self.params.get("input", {}).get("query")

        if not query:
            return await self.on_bad_input_received()

        # Assuming execution is always approved
        try:
            response = ApiProvider.send_ask_consultant_request(query)
            if not response or not response.result:
                return "Consultant failed to answer your question."

            # Skipping the relaySuccessfulResponse method
            return f"This is the advice from the consultant: {response.result}"
        except Exception as err:
            return (
                f"Consultant failed to answer your question with the error: {str(err)}"
            )

    async def on_bad_input_received(self):
        return """
        Error: Missing value for required parameter 'query'. Please retry with a complete response.
        A good example of an ask_consultant tool call is:
        {
            "tool": "ask_consultant",
            "query": "I want to build a multiplayer game where 100 players would be playing together at once. What framework should I choose for the backend? I'm confused between Elixir and colyseus"
        }
        Please try again with the correct query, you are not allowed to search without a query.
        """
