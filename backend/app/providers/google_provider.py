from __future__ import annotations

import asyncio
from typing import AsyncGenerator, Optional

from app.providers.base import BaseLLMProvider, LLMResponse


class GoogleProvider(BaseLLMProvider):
    def __init__(self, api_key: str, model_name: str = "gemini-2.0-flash"):
        super().__init__(api_key, model_name)
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        self._genai = genai
        self._model = genai.GenerativeModel(model_name)

    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.3,
        max_tokens: int = 4096,
        image_b64: Optional[str] = None,
    ) -> LLMResponse:
        parts: list = []

        if system_prompt:
            parts.append(f"[System]\n{system_prompt}\n\n[User]\n")

        if image_b64:
            import base64
            from io import BytesIO
            from PIL import Image
            img_bytes = base64.b64decode(image_b64)
            img = Image.open(BytesIO(img_bytes))
            parts.append(img)

        parts.append(prompt)

        generation_config = self._genai.types.GenerationConfig(
            temperature=temperature,
            max_output_tokens=max_tokens,
        )

        response = await asyncio.to_thread(
            self._model.generate_content,
            parts,
            generation_config=generation_config,
        )

        return LLMResponse(
            text=response.text,
            model=self.model_name,
            usage={},
            finish_reason=str(getattr(response, "finish_reason", "")),
        )

    async def generate_stream(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.3,
        max_tokens: int = 4096,
    ) -> AsyncGenerator[str, None]:
        parts: list = []
        if system_prompt:
            parts.append(f"[System]\n{system_prompt}\n\n[User]\n")
        parts.append(prompt)

        generation_config = self._genai.types.GenerationConfig(
            temperature=temperature,
            max_output_tokens=max_tokens,
        )

        response = await asyncio.to_thread(
            self._model.generate_content,
            parts,
            generation_config=generation_config,
            stream=True,
        )

        for chunk in response:
            if chunk.text:
                yield chunk.text
