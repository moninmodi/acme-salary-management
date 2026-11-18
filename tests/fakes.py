"""Deterministic test doubles shared by unit and integration tests."""
from types import SimpleNamespace


class FakeGeminiClient:
    """Return queued model responses without network access and record each request."""

    def __init__(self, *responses):
        """Store the ordered first-pass tool call and final phrasing responses."""
        self.responses = list(responses)
        self.requests: list[dict] = []
        self.models = self

    def generate_content(self, **kwargs):
        """Record the request and return the next queued response (raising it if it is an exception)."""
        self.requests.append(kwargs)
        response = self.responses.pop(0)
        if isinstance(response, Exception):
            raise response
        return response


def model_tool_call(name, args):
    """Build a small SDK-shaped tool call response."""
    call = SimpleNamespace(name=name, args=args)
    part = SimpleNamespace(function_call=call)
    content = SimpleNamespace(parts=[part])
    candidate = SimpleNamespace(content=content)
    return SimpleNamespace(candidates=[candidate])


def model_text(text):
    """Build a small SDK-shaped final text response."""
    return SimpleNamespace(text=text)
