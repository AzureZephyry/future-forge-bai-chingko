"""Explicit providers. No transport assumptions or automatic mock fallback."""

import json
from typing import Protocol

from .models import InferenceUnavailableError


class ModelProvider(Protocol):
    async def generate(self, prompt: str) -> str:
        """Return raw assessment JSON text, or raise an inference error.

        A future adapter owns transport, authentication, timeouts, and conversion
        of its documented provider response to text. The prompt is not an HTTP
        body or a prescribed chat-message format.
        """
        ...


class MockProvider:
    """Return the same response every time, with no network or content inference.

    Supply a JSON fixture to exercise assessment results. The conservative
    default makes no findings and explicitly identifies mock operation.
    Fixtures still pass through the service's production validation path.
    """

    def __init__(self, response: str | None = None) -> None:
        self._response = response if response is not None else json.dumps({
            "requirements": [],
            "uncertainty": (
                "Mock inference is active; no tender requirements were analyzed. "
                "Use a reviewed fixture for development assessment examples."
            ),
        }, sort_keys=True)

    async def generate(self, prompt: str) -> str:
        return self._response


class AlmaProvider:
    """Pending official organizer credentials and technical documentation."""

    async def generate(self, prompt: str) -> str:
        raise InferenceUnavailableError(
            "ALMA inference is unavailable: official API documentation and "
            "credentials have not been provided. No network request was made."
        )
