from __future__ import annotations

import asyncio
import logging
from typing import AsyncGenerator, Optional

from app.providers.base import BaseLLMProvider, LLMResponse

logger = logging.getLogger(__name__)


class GoogleProvider(BaseLLMProvider):
    def __init__(self, api_key: str, model_name: str = "gemini-2.0-flash"):
        super().__init__(api_key, model_name)
        from google import genai
        from google.genai import types

        self._genai = genai
        self._types = types
        # Initialize the client with the API key
        self._client = genai.Client(api_key=api_key)
        self._model_name = model_name

    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.3,
        max_tokens: int = 4096,
        image_b64: Optional[str] = None,
    ) -> LLMResponse:
        try:
            contents = []

            if system_prompt:
                contents.append(system_prompt)

            if image_b64:
                import base64
                contents.append({"text": prompt})
                contents.append({"inline_data": {"mime_type": "image/png", "data": image_b64}})
            else:
                contents.append(prompt)

            config = self._types.GenerateContentConfig(
                temperature=temperature,
                max_output_tokens=max_tokens,
            )

            response = await asyncio.to_thread(
                self._client.models.generate_content,
                model=self._model_name,
                contents=contents,
                config=config,
            )

            text = ""
            if response.candidates and len(response.candidates) > 0:
                for part in response.candidates[0].content.parts:
                    if hasattr(part, 'text') and part.text:
                        text += part.text

            return LLMResponse(
                text=text,
                model=self.model_name,
                usage={},
                finish_reason=str(response.candidates[0].finish_reason) if response.candidates else "",
            )
        except Exception as e:
            # Log the error with context
            exc_type = type(e).__name__
            exc_module = type(e).__module__

            logger.error(
                f"Google API error in generate: {exc_type}",
                extra={
                    "error_type": exc_type,
                    "error_module": exc_module,
                    "error_message": str(e)[:500],
                    "model": self._model_name,
                }
            )
            # Re-raise for the global handler to process
            raise

    async def generate_stream(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.3,
        max_tokens: int = 4096,
    ) -> AsyncGenerator[str, None]:
        contents = []

        if system_prompt:
            contents.append(system_prompt)
        contents.append(prompt)

        config = self._types.GenerateContentConfig(
            temperature=temperature,
            max_output_tokens=max_tokens,
        )

        response = await asyncio.to_thread(
            self._client.models.generate_content_stream,
            model=self._model_name,
            contents=contents,
            config=config,
        )

        for chunk in response:
            if hasattr(chunk, 'candidates') and chunk.candidates:
                for part in chunk.candidates[0].content.parts:
                    if hasattr(part, 'text') and part.text:
                        yield part.text
