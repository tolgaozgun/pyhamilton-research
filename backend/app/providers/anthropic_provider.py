from __future__ import annotations

from typing import AsyncGenerator, Optional

from app.providers.base import BaseLLMProvider, LLMResponse


class AnthropicProvider(BaseLLMProvider):
    def __init__(self, api_key: str, model_name: str = "claude-sonnet-4-20250514"):
        super().__init__(api_key, model_name)
        from anthropic import AsyncAnthropic
        self._client = AsyncAnthropic(api_key=api_key)

    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.3,
        max_tokens: int = 4096,
        image_b64: Optional[str] = None,
    ) -> LLMResponse:
        messages: list[dict] = []

        if image_b64:
            messages.append({
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/png",
                            "data": image_b64,
                        },
                    },
                    {"type": "text", "text": prompt},
                ],
            })
        else:
            messages.append({"role": "user", "content": prompt})

        kwargs: dict = {
            "model": self.model_name,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }
        if system_prompt:
            kwargs["system"] = system_prompt

        response = await self._client.messages.create(**kwargs)

        text = ""
        for block in response.content:
            if hasattr(block, "text"):
                text += block.text

        return LLMResponse(
            text=text,
            model=response.model,
            usage={
                "input_tokens": response.usage.input_tokens,
                "output_tokens": response.usage.output_tokens,
            },
            finish_reason=response.stop_reason or "",
        )

    async def generate_stream(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.3,
        max_tokens: int = 4096,
    ) -> AsyncGenerator[str, None]:
        messages: list[dict] = [{"role": "user", "content": prompt}]

        kwargs: dict = {
            "model": self.model_name,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }
        if system_prompt:
            kwargs["system"] = system_prompt

        async with self._client.messages.stream(**kwargs) as stream:
            async for text in stream.text_stream:
                yield text
