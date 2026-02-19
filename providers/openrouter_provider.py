from typing import Optional, Generator

from providers.openai_provider import OpenAIProvider
from providers.base import LLMResponse


class OpenRouterProvider(OpenAIProvider):
    """OpenRouter uses the OpenAI-compatible API with a different base URL."""

    def __init__(self, api_key: str, model_name: str):
        super().__init__(
            api_key=api_key,
            model_name=model_name,
            base_url="https://openrouter.ai/api/v1",
        )

    def _get_client(self):
        from openai import OpenAI
        return OpenAI(
            api_key=self.api_key,
            base_url=self.base_url,
            default_headers={
                "HTTP-Referer": "https://pyhamilton-agent.dev",
                "X-Title": "PyHamilton Automation Agent",
            },
        )
