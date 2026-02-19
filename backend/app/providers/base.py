from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import AsyncGenerator, Optional


@dataclass
class LLMResponse:
    text: str = ""
    model: str = ""
    usage: dict[str, int] = field(default_factory=dict)
    finish_reason: str = ""


class BaseLLMProvider(ABC):
    def __init__(self, api_key: str, model_name: str):
        self.api_key = api_key
        self.model_name = model_name

    @abstractmethod
    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.3,
        max_tokens: int = 4096,
        image_b64: Optional[str] = None,
    ) -> LLMResponse:
        ...

    @abstractmethod
    async def generate_stream(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.3,
        max_tokens: int = 4096,
    ) -> AsyncGenerator[str, None]:
        ...
        yield  # noqa: type: ignore  — makes this a valid async generator stub
