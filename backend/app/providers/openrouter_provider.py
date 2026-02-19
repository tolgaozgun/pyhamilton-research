from __future__ import annotations

from app.providers.openai_provider import OpenAIProvider

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"


class OpenRouterProvider(OpenAIProvider):
    def __init__(self, api_key: str, model_name: str = "openai/gpt-4o"):
        super().__init__(api_key, model_name, base_url=OPENROUTER_BASE_URL)
