from typing import Optional, Generator

from providers.base import BaseLLMProvider, LLMResponse


class OpenAIProvider(BaseLLMProvider):

    def __init__(self, api_key: str, model_name: str, base_url: Optional[str] = None):
        super().__init__(api_key, model_name)
        self.base_url = base_url

    def _get_client(self):
        from openai import OpenAI
        kwargs = {"api_key": self.api_key}
        if self.base_url:
            kwargs["base_url"] = self.base_url
        return OpenAI(**kwargs)

    def _build_user_content(self, user_prompt: str, image_path: Optional[str] = None) -> list:
        content = [{"type": "text", "text": user_prompt}]
        if image_path:
            data, mime = self._encode_image(image_path)
            content.append({
                "type": "image_url",
                "image_url": {"url": f"data:{mime};base64,{data}"},
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
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": self._build_user_content(user_prompt, image_path)},
        ]
        response = client.chat.completions.create(
            model=self.model_name,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        choice = response.choices[0]
        return LLMResponse(
            text=choice.message.content,
            model=self.model_name,
            finish_reason=choice.finish_reason,
            usage={
                "prompt_tokens": response.usage.prompt_tokens,
                "completion_tokens": response.usage.completion_tokens,
            } if response.usage else None,
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
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": self._build_user_content(user_prompt, image_path)},
        ]
        stream = client.chat.completions.create(
            model=self.model_name,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=True,
        )
        for chunk in stream:
            delta = chunk.choices[0].delta
            if delta.content:
                yield delta.content
