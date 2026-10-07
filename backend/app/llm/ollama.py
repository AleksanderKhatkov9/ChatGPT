import json

import httpx

from app.errors import UpstreamError


class OllamaClient:
    def __init__(self, base_url: str):
        self._base = base_url.rstrip("/")

    async def list_models(self) -> list[str]:
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(10.0)) as client:
                response = await client.get(f"{self._base}/api/tags")
        except httpx.RequestError as exc:
            raise UpstreamError(f"Cannot reach Ollama at {self._base}: {exc}") from exc

        if response.status_code != 200:
            raise UpstreamError(response.text or "Ollama model list failed")

        payload = response.json()
        names: list[str] = []
        for item in payload.get("models") or []:
            name = item.get("name")
            if isinstance(name, str) and name:
                names.append(name)
        return names

    async def stream_chat(
        self,
        model: str,
        messages: list[dict[str, str]],
        temperature: float,
    ):
        payload = {
            "model": model,
            "messages": messages,
            "stream": True,
            "options": {"temperature": temperature},
        }
        timeout = httpx.Timeout(connect=10.0, read=300.0, write=30.0, pool=10.0)
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                async with client.stream(
                    "POST", f"{self._base}/api/chat", json=payload
                ) as response:
                    if response.status_code != 200:
                        body = (await response.aread()).decode("utf-8", errors="replace")
                        raise UpstreamError(body or f"Ollama returned {response.status_code}")
                    async for line in response.aiter_lines():
                        token = _token_from_line(line)
                        if token:
                            yield token
        except httpx.RequestError as exc:
            raise UpstreamError(f"Cannot reach Ollama at {self._base}: {exc}") from exc


def _token_from_line(line: str) -> str:
    if not line.strip():
        return ""
    try:
        data = json.loads(line)
    except json.JSONDecodeError:
        return ""
    if data.get("error"):
        raise UpstreamError(str(data["error"]))
    message = data.get("message") or {}
    content = message.get("content") or ""
    return content if isinstance(content, str) else ""
