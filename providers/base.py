from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional, Generator


@dataclass
class LLMResponse:
    text: str
    model: str
    usage: Optional[dict] = None
    finish_reason: Optional[str] = None


class BaseLLMProvider(ABC):

    def __init__(self, api_key: str, model_name: str):
        self.api_key = api_key
        self.model_name = model_name

    @abstractmethod
    def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.4,
        max_tokens: int = 4096,
        image_path: Optional[str] = None,
    ) -> LLMResponse:
        ...

    @abstractmethod
    def generate_stream(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.4,
        max_tokens: int = 4096,
        image_path: Optional[str] = None,
    ) -> Generator[str, None, None]:
        ...

    def _encode_image(self, image_path: str) -> tuple[str, str]:
        import base64
        with open(image_path, "rb") as f:
            data = base64.b64encode(f.read()).decode("utf-8")
        mime = "image/png" if image_path.lower().endswith(".png") else "image/jpeg"
        return data, mime
