import os
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from main import app, get_supabase
from routes.chat import get_async_anthropic
from routes.chat import get_supabase as chat_get_supabase
TRIP_ID = "550e8400-e29b-41d4-a716-446655440000"
BOOKING_ID = "uuid-booking-auth-test"
DATE = "2026-06-20"

MOCK_BOOKING = {
    "id": BOOKING_ID,
    "trip_id": TRIP_ID,
    "title": "Test Booking",
    "subtitle": "test",
    "category": "hotels",
    "urgency": "fire",
    "status": "booked",
    "estimated_cost": 100.0,
    "actual_cost": None,
    "deadline": "Soon",
    "discount_code": None,
    "card_tip": "Visa",
    "booked_at": None,
}


def _make_booking_supabase_mock() -> MagicMock:
    mock = MagicMock()
    trip_resp = MagicMock()
    trip_resp.data = [{"id": TRIP_ID}]
    booking_resp = MagicMock()
    booking_resp.data = [MOCK_BOOKING]

    def table_side_effect(table_name: str) -> MagicMock:
        chain = MagicMock()
        if table_name == "trips":
            chain.select.return_value.eq.return_value.execute.return_value = trip_resp
        else:
            chain.select.return_value.eq.return_value.eq.return_value.execute.return_value = (
                booking_resp
            )
            chain.update.return_value.eq.return_value.eq.return_value.execute.return_value = (
                booking_resp
            )
        return chain

    mock.table.side_effect = table_side_effect
    return mock


def _make_get_supabase_mock() -> MagicMock:
    mock = MagicMock()
    trip_resp = MagicMock()
    trip_resp.data = [{"id": TRIP_ID}]
    empty_resp = MagicMock()
    empty_resp.data = []

    def table_side_effect(table_name: str) -> MagicMock:
        chain = MagicMock()
        if table_name == "trips":
            chain.select.return_value.eq.return_value.execute.return_value = trip_resp
        else:
            chain.select.return_value.eq.return_value.execute.return_value = empty_resp
        return chain

    mock.table.side_effect = table_side_effect
    return mock


def _make_chat_supabase_mock() -> MagicMock:
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


async def _async_iter(items: list[str]):  # type: ignore[return]
    for item in items:
        yield item


def _make_chat_claude_mock() -> MagicMock:
    mock_client = MagicMock()
    mock_stream = MagicMock()
    mock_stream.text_stream = _async_iter(["Hello"])
    mock_stream_mgr = AsyncMock()
    mock_stream_mgr.__aenter__.return_value = mock_stream
    mock_stream_mgr.__aexit__.return_value = None
    mock_client.messages.stream.return_value = mock_stream_mgr
    return mock_client


def teardown_function() -> None:
    app.dependency_overrides.clear()


# ── 403 when key is missing ───────────────────────────────────────────────────


def test_patch_booking_without_key_returns_403() -> None:
    client = TestClient(app)
    resp = client.patch(
        f"/trips/{TRIP_ID}/bookings/{BOOKING_ID}",
        json={"status": "booked"},
    )
    assert resp.status_code == 403


def test_patch_booking_without_key_body_says_admin_key_required() -> None:
    client = TestClient(app)
    resp = client.patch(
        f"/trips/{TRIP_ID}/bookings/{BOOKING_ID}",
        json={"status": "booked"},
    )
    assert resp.json()["detail"] == "Admin API key required"


def test_patch_booking_with_wrong_key_returns_403() -> None:
    client = TestClient(app)
    resp = client.patch(
        f"/trips/{TRIP_ID}/bookings/{BOOKING_ID}",
        json={"status": "booked"},
        headers={"X-API-Key": "wrong-key"},
    )
    assert resp.status_code == 403


def test_patch_itinerary_without_key_returns_403() -> None:
    client = TestClient(app)
    resp = client.patch(
        f"/trips/{TRIP_ID}/itinerary/{DATE}",
        json={"title": "Updated"},
    )
    assert resp.status_code == 403


def test_post_suggest_without_key_returns_403() -> None:
    client = TestClient(app)
    resp = client.post(f"/trips/{TRIP_ID}/itinerary/{DATE}/suggest")
    assert resp.status_code == 403


def test_post_create_day_without_key_returns_403() -> None:
    client = TestClient(app)
    resp = client.post(
        f"/trips/{TRIP_ID}/itinerary",
        json={
            "date": "2026-07-10",
            "city": "Rome",
            "country": "Italy",
            "title": "Rome day",
        },
    )
    assert resp.status_code == 403


def test_delete_day_without_key_returns_403() -> None:
    client = TestClient(app)
    resp = client.delete(f"/trips/{TRIP_ID}/itinerary/{DATE}")
    assert resp.status_code == 403


def test_chat_index_without_key_returns_403() -> None:
    client = TestClient(app)
    resp = client.post(f"/trips/{TRIP_ID}/chat/index")
    assert resp.status_code == 403


# ── Correct key passes through ────────────────────────────────────────────────


def test_patch_booking_with_correct_key_is_not_403() -> None:
    app.dependency_overrides[get_supabase] = lambda: _make_booking_supabase_mock()
    client = TestClient(app)
    resp = client.patch(
        f"/trips/{TRIP_ID}/bookings/{BOOKING_ID}",
        json={"status": "booked"},
        headers={"X-API-Key": os.environ["ADMIN_API_KEY"]},
    )
    assert resp.status_code != 403


# ── Open endpoints: no key needed ─────────────────────────────────────────────


def test_chat_without_key_is_not_guarded() -> None:
    app.dependency_overrides[chat_get_supabase] = lambda: _make_chat_supabase_mock()
    app.dependency_overrides[get_async_anthropic] = lambda: _make_chat_claude_mock()
    client = TestClient(app)
    with patch("routes.chat.retrieve", return_value=[]):
        resp = client.post(f"/trips/{TRIP_ID}/chat", json={"query": "What hotel?"})
    assert resp.status_code != 403


def test_get_bookings_without_key_succeeds() -> None:
    app.dependency_overrides[get_supabase] = lambda: _make_get_supabase_mock()
    client = TestClient(app)
    resp = client.get(f"/trips/{TRIP_ID}/bookings")
    assert resp.status_code != 403


def test_get_itinerary_without_key_succeeds() -> None:
    app.dependency_overrides[get_supabase] = lambda: _make_get_supabase_mock()
    client = TestClient(app)
    resp = client.get(f"/trips/{TRIP_ID}/itinerary")
    assert resp.status_code != 403


def test_health_without_key_succeeds() -> None:
    client = TestClient(app)
    resp = client.get("/health")
    assert resp.status_code == 200


# ── Fail closed: unset env var blocks even with a key ─────────────────────────


def test_fail_closed_when_env_unset(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("ADMIN_API_KEY", raising=False)
    client = TestClient(app)
    resp = client.patch(
        f"/trips/{TRIP_ID}/bookings/{BOOKING_ID}",
        json={"status": "booked"},
        headers={"X-API-Key": "any-key"},
    )
    assert resp.status_code == 403
