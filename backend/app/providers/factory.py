from __future__ import annotations

from app.config import Provider
from app.providers.base import BaseLLMProvider
from app.providers.google_provider import GoogleProvider
from app.providers.openai_provider import OpenAIProvider
from app.providers.anthropic_provider import AnthropicProvider
from app.providers.openrouter_provider import OpenRouterProvider


def create_provider(
    provider: Provider | str,
    api_key: str,
    model_name: str,
) -> BaseLLMProvider:
    if isinstance(provider, str):
        provider = Provider(provider)

    factories = {
        Provider.GOOGLE: GoogleProvider,
        Provider.OPENAI: OpenAIProvider,
        Provider.ANTHROPIC: AnthropicProvider,
        Provider.OPENROUTER: OpenRouterProvider,
    }

    cls = factories.get(provider)
    if cls is None:
        raise ValueError(f"Unsupported provider: {provider}")

    return cls(api_key=api_key, model_name=model_name)
