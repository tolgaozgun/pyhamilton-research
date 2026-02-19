from typing import Optional, Generator

import google.generativeai as genai
from PIL import Image

from providers.base import BaseLLMProvider, LLMResponse


class GoogleProvider(BaseLLMProvider):

    def __init__(self, api_key: str, model_name: str):
        super().__init__(api_key, model_name)
        genai.configure(api_key=api_key)

    def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.4,
        max_tokens: int = 4096,
        image_path: Optional[str] = None,
    ) -> LLMResponse:
        model = genai.GenerativeModel(
            model_name=self.model_name,
            system_instruction=system_prompt,
            generation_config=genai.GenerationConfig(
                temperature=temperature,
                max_output_tokens=max_tokens,
            ),
        )
        parts = [user_prompt]
        if image_path:
            parts.append(Image.open(image_path))
            parts.append("Use the attached image as reference for the deck layout.")

        response = model.generate_content(parts)
        return LLMResponse(
            text=response.text,
            model=self.model_name,
            finish_reason="stop",
        )

    def generate_stream(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.4,
        max_tokens: int = 4096,
        image_path: Optional[str] = None,
    ) -> Generator[str, None, None]:
        model = genai.GenerativeModel(
            model_name=self.model_name,
            system_instruction=system_prompt,
            generation_config=genai.GenerationConfig(
                temperature=temperature,
                max_output_tokens=max_tokens,
            ),
        )
        parts = [user_prompt]
        if image_path:
            parts.append(Image.open(image_path))
            parts.append("Use the attached image as reference for the deck layout.")

        response = model.generate_content(parts, stream=True)
        for chunk in response:
            if chunk.text:
                yield chunk.text
