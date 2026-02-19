from typing import Optional, Generator

from providers.base import BaseLLMProvider, LLMResponse


class AnthropicProvider(BaseLLMProvider):

    def _get_client(self):
        import anthropic
        return anthropic.Anthropic(api_key=self.api_key)

    def _build_user_content(self, user_prompt: str, image_path: Optional[str] = None) -> list:
        content = [{"type": "text", "text": user_prompt}]
        if image_path:
            data, mime = self._encode_image(image_path)
            content.append({
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": mime,
                    "data": data,
                },
            })
        return content

    def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.4,
        max_tokens: int = 4096,
        image_path: Optional[str] = None,
    ) -> LLMResponse:
        client = self._get_client()
        response = client.messages.create(
            model=self.model_name,
            max_tokens=max_tokens,
            temperature=temperature,
            system=system_prompt,
            messages=[{"role": "user", "content": self._build_user_content(user_prompt, image_path)}],
        )
        return LLMResponse(
            text=response.content[0].text,
            model=self.model_name,
            finish_reason=response.stop_reason,
            usage={
                "input_tokens": response.usage.input_tokens,
                "output_tokens": response.usage.output_tokens,
            },
        )

    def generate_stream(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.4,
        max_tokens: int = 4096,
        image_path: Optional[str] = None,
    ) -> Generator[str, None, None]:
        client = self._get_client()
        with client.messages.stream(
            model=self.model_name,
            max_tokens=max_tokens,
            temperature=temperature,
            system=system_prompt,
            messages=[{"role": "user", "content": self._build_user_content(user_prompt, image_path)}],
        ) as stream:
            for text in stream.text_stream:
                yield text
