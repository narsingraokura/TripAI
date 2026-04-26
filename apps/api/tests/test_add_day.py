"""
Tests for:
  POST /api/trips/{trip_id}/itinerary/days  — position-based insert with re-indexing
  POST /api/trips/{trip_id}/itinerary/validate — AI-powered mutation validation
"""
import json
import os
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.routers.itinerary import get_anthropic as itinerary_get_anthropic
from app.routers.itinerary import get_supabase as itinerary_get_supabase
from main import app

TIMESTAMP = "2026-04-24T00:00:00+00:00"
API_KEY = "test-key-12345"


@pytest.fixture()
def trip_id() -> str:
    return os.environ.get("TRIP_ID", "550e8400-e29b-41d4-a716-446655440000")


# ── Factories ──────────────────────────────────────────────────────────────────

def _day_pos3(trip_id: str) -> dict:
    """A day that already exists at position 3 — will shift to 4 on insert at 3."""
    return {
        "id": "day-uuid-03",
        "trip_id": trip_id,
        "position": 3,
        "date": "2026-06-21",
        "city": "London",
        "country": "UK",
        "day_type": "exploration",
        "notes": "London day",
        "title": "London",
        "plan": "",
        "intensity": "moderate",
        "is_special": False,
        "special_label": None,
        "created_at": TIMESTAMP,
        "updated_at": TIMESTAMP,
    }


def _inserted_day(trip_id: str) -> dict:
    """The newly inserted day row returned from Supabase after insert."""
    return {
        "id": "day-uuid-new",
        "trip_id": trip_id,
        "position": 3,
        "date": "2026-06-21",
        "city": "New City",
        "country": "",
        "day_type": "rest",
        "notes": None,
        "title": "New City",
        "plan": "",
        "intensity": "light",
        "is_special": False,
        "special_label": None,
        "created_at": TIMESTAMP,
        "updated_at": TIMESTAMP,
    }


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_trip_chain(trip_id: str, found: bool = True) -> MagicMock:
    chain = MagicMock()
    chain.select.return_value.eq.return_value.execute.return_value.data = (
        [{"id": trip_id}] if found else []
    )
    return chain


def _make_days_chain(
    affected_rows: list,
    inserted_row: dict,
) -> MagicMock:
    """Return a days-table mock with select / upsert / insert chains all wired."""
    chain = MagicMock()

    # select("*").eq("trip_id", ...).gte("position", ...).execute()
    affected = MagicMock()
    affected.data = affected_rows
    chain.select.return_value.eq.return_value.gte.return_value.execute.return_value = affected

    # upsert([...]).execute()
    upserted = MagicMock()
    upserted.data = [{**r, "position": r["position"] + 1} for r in affected_rows]
    chain.upsert.return_value.execute.return_value = upserted

    # insert({...}).execute()
    inserted = MagicMock()
    inserted.data = [inserted_row]
    chain.insert.return_value.execute.return_value = inserted

    return chain


def _make_client(mock_sb: MagicMock, mock_claude: MagicMock | None = None) -> TestClient:
    app.dependency_overrides[itinerary_get_supabase] = lambda: mock_sb
    if mock_claude is not None:
        app.dependency_overrides[itinerary_get_anthropic] = lambda: mock_claude
    return TestClient(app)


def teardown_function() -> None:
    app.dependency_overrides.clear()


# ── POST /api/trips/{trip_id}/itinerary/days ──────────────────────────────────

def test_add_day_returns_201(trip_id: str) -> None:
    """POST /days returns 201 with the created day on success."""
    mock_sb = MagicMock()

    def table_side_effect(name: str) -> MagicMock:
        if name == "trips":
            return _make_trip_chain(trip_id)
        return _make_days_chain(affected_rows=[], inserted_row=_inserted_day(trip_id))

    mock_sb.table.side_effect = table_side_effect
    client = _make_client(mock_sb)
    response = client.post(
        f"/api/trips/{trip_id}/itinerary/days",
        json={"position": 3, "date": "2026-06-21", "city": "New City", "day_type": "rest"},
        headers={"X-API-Key": API_KEY},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["id"] == "day-uuid-new"
    assert body["city"] == "New City"
    assert body["position"] == 3


def test_add_day_response_has_required_fields(trip_id: str) -> None:
    """Created day response includes all Day model fields."""
    mock_sb = MagicMock()
    mock_sb.table.side_effect = lambda name: (
        _make_trip_chain(trip_id) if name == "trips"
        else _make_days_chain([], _inserted_day(trip_id))
    )
    client = _make_client(mock_sb)
    body = client.post(
        f"/api/trips/{trip_id}/itinerary/days",
        json={"position": 3, "date": "2026-06-21", "city": "New City", "day_type": "rest"},
        headers={"X-API-Key": API_KEY},
    ).json()
    for field in ("id", "trip_id", "position", "date", "city", "day_type", "activities"):
        assert field in body, f"missing field: {field}"


def test_add_day_shifts_existing_positions(trip_id: str) -> None:
    """Days at position >= new_position are upserted with position + 1."""
    mock_sb = MagicMock()
    days_chain = _make_days_chain(
        affected_rows=[_day_pos3(trip_id)],
        inserted_row=_inserted_day(trip_id),
    )

    mock_sb.table.side_effect = lambda name: (
        _make_trip_chain(trip_id) if name == "trips" else days_chain
    )
    client = _make_client(mock_sb)
    client.post(
        f"/api/trips/{trip_id}/itinerary/days",
        json={"position": 3, "date": "2026-06-21", "city": "New City", "day_type": "rest"},
        headers={"X-API-Key": API_KEY},
    )
    # Upsert must be called with the shifted rows.
    days_chain.upsert.assert_called_once()
    upsert_arg = days_chain.upsert.call_args[0][0]
    assert len(upsert_arg) == 1
    assert upsert_arg[0]["position"] == _day_pos3(trip_id)["position"] + 1


def test_add_day_at_end_no_upsert(trip_id: str) -> None:
    """Inserting after the last day (no affected rows) skips the upsert call."""
    mock_sb = MagicMock()
    days_chain = _make_days_chain(affected_rows=[], inserted_row=_inserted_day(trip_id))
    mock_sb.table.side_effect = lambda name: (
        _make_trip_chain(trip_id) if name == "trips" else days_chain
    )
    client = _make_client(mock_sb)
    client.post(
        f"/api/trips/{trip_id}/itinerary/days",
        json={"position": 6, "date": "2026-07-06", "city": "Rome", "day_type": "exploration"},
        headers={"X-API-Key": API_KEY},
    )
    days_chain.upsert.assert_not_called()


def test_add_day_404_trip_not_found(trip_id: str) -> None:
    """Returns 404 when the trip does not exist."""
    mock_sb = MagicMock()
    mock_sb.table.side_effect = lambda name: (
        _make_trip_chain(trip_id, found=False) if name == "trips"
        else _make_days_chain([], _inserted_day(trip_id))
    )
    client = _make_client(mock_sb)
    response = client.post(
        f"/api/trips/{trip_id}/itinerary/days",
        json={"position": 1, "date": "2026-06-19", "city": "Paris", "day_type": "exploration"},
        headers={"X-API-Key": API_KEY},
    )
    assert response.status_code == 404


def test_add_day_requires_auth(trip_id: str) -> None:
    """Returns 403 when X-API-Key header is absent (Supabase not reached)."""
    mock_sb = MagicMock()
    mock_sb.table.side_effect = lambda name: _make_trip_chain(trip_id)
    client = _make_client(mock_sb)
    response = client.post(
        f"/api/trips/{trip_id}/itinerary/days",
        json={"position": 1, "date": "2026-06-19", "city": "Paris", "day_type": "exploration"},
    )
    assert response.status_code == 403


# ── POST /api/trips/{trip_id}/itinerary/validate ──────────────────────────────

def _make_validate_supabase(trip_id: str, days: list | None = None) -> MagicMock:
    """Build a Supabase mock that satisfies the validate route's three table reads."""
    mock_sb = MagicMock()

    def table_side_effect(name: str) -> MagicMock:
        chain = MagicMock()
        if name == "trips":
            chain.select.return_value.eq.return_value.execute.return_value.data = [
                {"id": trip_id}
            ]
        elif name == "itinerary_days":
            chain.select.return_value.eq.return_value.execute.return_value.data = (
                days if days is not None else [_day_pos3(trip_id)]
            )
        else:
            # trip_goals / trip_constraints
            chain.select.return_value.eq.return_value.execute.return_value.data = []
        return chain

    mock_sb.table.side_effect = table_side_effect
    return mock_sb


def _make_claude_mock(status: str = "ok", message: str = "Looks good.") -> MagicMock:
    mock_claude = MagicMock()
    payload = json.dumps({"status": status, "message": message})
    mock_claude.messages.create.return_value.content = [MagicMock(text=payload)]
    return mock_claude


def test_validate_returns_200_with_status_and_message(trip_id: str) -> None:
    """POST /validate returns 200 with status and message from Claude."""
    client = _make_client(
        _make_validate_supabase(trip_id),
        _make_claude_mock("ok", "Adding a day is fine."),
    )
    response = client.post(
        f"/api/trips/{trip_id}/itinerary/validate",
        json={"mutation_type": "add_day", "mutation_description": "Adding a rest day in Paris"},
        headers={"X-API-Key": API_KEY},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert isinstance(body["message"], str) and body["message"]


def test_validate_forwards_warning_status(trip_id: str) -> None:
    """Validation results are not filtered — 'warning' passes through."""
    client = _make_client(
        _make_validate_supabase(trip_id),
        _make_claude_mock("warning", "Consider the pace impact."),
    )
    body = client.post(
        f"/api/trips/{trip_id}/itinerary/validate",
        json={"mutation_type": "add_day", "mutation_description": "Adding a 4th consecutive busy day"},
        headers={"X-API-Key": API_KEY},
    ).json()
    assert body["status"] == "warning"


def test_validate_404_trip_not_found(trip_id: str) -> None:
    """Returns 404 when the trip does not exist."""
    mock_sb = MagicMock()
    mock_sb.table.side_effect = lambda name: _make_trip_chain(trip_id, found=False)
    client = _make_client(mock_sb)
    response = client.post(
        f"/api/trips/{trip_id}/itinerary/validate",
        json={"mutation_type": "add_day", "mutation_description": "test"},
        headers={"X-API-Key": API_KEY},
    )
    assert response.status_code == 404


def test_validate_requires_auth(trip_id: str) -> None:
    """Returns 403 when X-API-Key header is absent (guard fires before Claude is called)."""
    mock_sb = MagicMock()
    mock_sb.table.side_effect = lambda name: _make_trip_chain(trip_id)
    # Mock Claude so that if auth somehow passes the discriminating status is 403 not 5xx.
    client = _make_client(mock_sb, _make_claude_mock())
    response = client.post(
        f"/api/trips/{trip_id}/itinerary/validate",
        json={"mutation_type": "add_day", "mutation_description": "test"},
    )
    assert response.status_code == 403


def test_validate_claude_error_returns_502(trip_id: str) -> None:
    """If Claude returns malformed JSON, route returns 502."""
    mock_claude = MagicMock()
    mock_claude.messages.create.return_value.content = [MagicMock(text="not valid json")]
    client = _make_client(_make_validate_supabase(trip_id), mock_claude)
    response = client.post(
        f"/api/trips/{trip_id}/itinerary/validate",
        json={"mutation_type": "add_day", "mutation_description": "test"},
        headers={"X-API-Key": API_KEY},
    )
    assert response.status_code == 502
