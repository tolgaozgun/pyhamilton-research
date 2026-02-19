from config import Provider
from providers.base import BaseLLMProvider
from providers.google_provider import GoogleProvider
from providers.openai_provider import OpenAIProvider
from providers.anthropic_provider import AnthropicProvider
from providers.openrouter_provider import OpenRouterProvider


def create_provider(provider: Provider, api_key: str, model_name: str) -> BaseLLMProvider:
    if provider == Provider.GOOGLE:
        return GoogleProvider(api_key, model_name)
    elif provider == Provider.OPENAI:
        return OpenAIProvider(api_key, model_name)
    elif provider == Provider.ANTHROPIC:
        return AnthropicProvider(api_key, model_name)
    elif provider == Provider.OPENROUTER:
        return OpenRouterProvider(api_key, model_name)
    raise ValueError(f"Unknown provider: {provider}")
