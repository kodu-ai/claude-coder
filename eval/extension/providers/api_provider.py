import os
import requests
from typing import Dict, Optional

KODU_BASE_URL = "https://www.kodu.ai"


# Helper functions for generating URLs
def get_kodu_sign_in_url(
    uri_scheme: Optional[str] = None, extension_name: Optional[str] = None
) -> str:
    return f"{KODU_BASE_URL}/auth/login?redirectTo={uri_scheme}://kodu-ai.{extension_name}&ext=1"


def get_kodu_inference_url() -> str:
    return f"{KODU_BASE_URL}/api/inference-stream"


def get_kodu_summarize_url() -> str:
    return f"{KODU_BASE_URL}/api/tools/summarize"


def get_kodu_web_search_url() -> str:
    return f"{KODU_BASE_URL}/api/tools/web-search"


def get_kodu_screenshot_url() -> str:
    return f"{KODU_BASE_URL}/api/tools/screenshot"


def get_kodu_consultant_url() -> str:
    return f"{KODU_BASE_URL}/api/tools/consultant"


def get_kodu_homepage_url() -> str:
    return KODU_BASE_URL


# DTO types (using Python dictionaries)
class WebSearchResponseDto:
    def __init__(self, content: str):
        self.content = content


class AskConsultantResponseDto:
    def __init__(self, result: str):
        self.result = result


class SummaryResponseDto:
    def __init__(self, result: str):
        self.result = result


class ApiProvider:
    def __init__(self):
        self.api_key = os.getenv("KODU_API_KEY")

    def _get_headers(self) -> Dict[str, str]:
        return {
            "Content-Type": "application/json",
            "x-api-key": self.api_key or "",
        }

    def send_web_search_request(
        self, search_query: str, base_link: str
    ) -> WebSearchResponseDto:
        response = requests.post(
            get_kodu_web_search_url(),
            json={"searchQuery": search_query, "baseLink": base_link},
            headers=self._get_headers(),
            timeout=60,
        )
        response.raise_for_status()
        return WebSearchResponseDto(content=response.json().get("content"))

    def send_url_screenshot_request(self, url: str) -> bytes:
        response = requests.post(
            get_kodu_screenshot_url(),
            json={"url": url},
            headers=self._get_headers(),
            timeout=60,
        )
        response.raise_for_status()
        return response.content  # Return raw image data

    def send_ask_consultant_request(self, query: str) -> AskConsultantResponseDto:
        response = requests.post(
            get_kodu_consultant_url(),
            json={"query": query},
            headers=self._get_headers(),
            timeout=60,
        )
        response.raise_for_status()
        return AskConsultantResponseDto(result=response.json().get("result"))

    def send_summarize_request(self, output: str, command: str) -> SummaryResponseDto:
        response = requests.post(
            get_kodu_summarize_url(),
            json={"output": output, "command": command},
            headers=self._get_headers(),
            timeout=60,
        )
        response.raise_for_status()
        return SummaryResponseDto(result=response.json().get("result"))
