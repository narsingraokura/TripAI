import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from main import app
from rag.guardrail import classify_query
from routes.chat import get_async_anthropic
from routes.chat import get_supabase as chat_get_supabase

TRIP_ID = "550e8400-e29b-41d4-a716-446655440000"


# ── Helpers ────────────────────────────────────────────────────────────────────


def _make_haiku_response(text: str) -> MagicMock:
    content_block = MagicMock()
    content_block.text = text
    response = MagicMock()
    response.content = [content_block]
    return response


def _make_supabase_mock() -> MagicMock:
    mock = MagicMock()
    trip_resp = MagicMock()
    trip_resp.data = [{"id": TRIP_ID}]
    log_resp = MagicMock()
    log_resp.data = [{"id": "log-uuid"}]

    def table_side_effect(table_name: str) -> MagicMock:
        chain = MagicMock()
        if table_name == "trips":
            chain.select.return_value.eq.return_value.execute.return_value = trip_resp
        elif table_name == "chat_logs":
            chain.insert.return_value.execute.return_value = log_resp
        return chain

    mock.table.side_effect = table_side_effect
    return mock


def _parse_sse_events(text: str) -> list[dict]:  # type: ignore[type-arg]
    events = []
    for line in text.splitlines():
        if line.startswith("data: ") and line.strip() != "data: [DONE]":
            events.append(json.loads(line[6:]))
    return events


# ── Unit tests for classify_query ─────────────────────────────────────────────


@pytest.mark.asyncio
async def test_classify_query_code_help_returns_off_topic() -> None:
    mock_client = AsyncMock()
    mock_client.messages.create.return_value = _make_haiku_response("off_topic")
    result = await classify_query("Write me Python code for a web scraper", client=mock_client)
    assert result == "off_topic"


@pytest.mark.asyncio
async def test_classify_query_paris_hotel_returns_trip() -> None:
    mock_client = AsyncMock()
    mock_client.messages.create.return_value = _make_haiku_response("trip")
    result = await classify_query("What hotel are we staying at in Paris?", client=mock_client)
    assert result == "trip"


@pytest.mark.asyncio
async def test_classify_query_malformed_response_defaults_to_off_topic() -> None:
    mock_client = AsyncMock()
    mock_client.messages.create.return_value = _make_haiku_response("maybe I can help")
    result = await classify_query("some query", client=mock_client)
    assert result == "off_topic"


@pytest.mark.asyncio
async def test_classify_query_empty_response_defaults_to_off_topic() -> None:
    mock_client = AsyncMock()
    mock_client.messages.create.return_value = _make_haiku_response("")
    result = await classify_query("some query", client=mock_client)
    assert result == "off_topic"


@pytest.mark.asyncio
async def test_classify_query_api_exception_falls_through_to_trip() -> None:
    mock_client = AsyncMock()
    mock_client.messages.create.side_effect = Exception("API unavailable")
    result = await classify_query("some query", client=mock_client)
    assert result == "trip"


# ── Integration: off-topic query returns refusal, RAG never called ─────────────


def test_chat_off_topic_returns_refusal_without_hitting_rag() -> None:
    supabase_mock = _make_supabase_mock()
    claude_mock = MagicMock()
    app.dependency_overrides[chat_get_supabase] = lambda: supabase_mock
    app.dependency_overrides[get_async_anthropic] = lambda: claude_mock
    client = TestClient(app)
    try:
        with patch("routes.chat.classify_query", new=AsyncMock(return_value="off_topic")):
            with patch("routes.chat.retrieve") as mock_retrieve:
                resp = client.post(
                    f"/trips/{TRIP_ID}/chat",
                    json={"query": "Write me Python code"},
                )
        assert resp.status_code == 200
        assert "text/event-stream" in resp.headers["content-type"]
        events = _parse_sse_events(resp.text)
        token_events = [e for e in events if e["type"] == "token"]
        done_events = [e for e in events if e["type"] == "done"]
        assert len(token_events) == 1
        assert "Europe 2026 trip" in token_events[0]["content"]
        assert len(done_events) == 1
        assert "conversation_id" in done_events[0]
        assert "data: [DONE]" in resp.text
        mock_retrieve.assert_not_called()
        claude_mock.messages.stream.assert_not_called()
    finally:
        app.dependency_overrides.clear()
