"""
Tests for:
  POST /api/trips/{trip_id}/itinerary/days  — position-based insert with re-indexing
  POST /api/trips/{trip_id}/itinerary/validate — AI-powered mutation validation
"""
import json
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.routers.itinerary import get_anthropic as itinerary_get_anthropic
from app.routers.itinerary import get_supabase as itinerary_get_supabase
from main import app

TRIP_ID = "550e8400-e29b-41d4-a716-446655440000"
TIMESTAMP = "2026-04-24T00:00:00+00:00"
API_KEY = "test-key-12345"

# A day that already exists at position 3 — will be shifted to 4 when we insert at 3.
EXISTING_DAY_POS3 = {
    "id": "day-uuid-03",
    "trip_id": TRIP_ID,
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

# The newly inserted day row returned from Supabase after insert.
INSERTED_DAY = {
    "id": "day-uuid-new",
    "trip_id": TRIP_ID,
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

# A day at position 5 — the "last" day; inserting at position 6 causes no shift.
LAST_DAY_POS5 = {**EXISTING_DAY_POS3, "id": "day-uuid-05", "position": 5}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_trip_chain(found: bool = True) -> MagicMock:
    chain = MagicMock()
    chain.select.return_value.eq.return_value.execute.return_value.data = (
        [{"id": TRIP_ID}] if found else []
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

def test_add_day_returns_201() -> None:
    """POST /days returns 201 with the created day on success."""
    mock_sb = MagicMock()

    def table_side_effect(name: str) -> MagicMock:
        if name == "trips":
            return _make_trip_chain()
        return _make_days_chain(affected_rows=[], inserted_row=INSERTED_DAY)

    mock_sb.table.side_effect = table_side_effect
    client = _make_client(mock_sb)
    response = client.post(
        f"/api/trips/{TRIP_ID}/itinerary/days",
        json={"position": 3, "date": "2026-06-21", "city": "New City", "day_type": "rest"},
        headers={"X-API-Key": API_KEY},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["id"] == "day-uuid-new"
    assert body["city"] == "New City"
    assert body["position"] == 3


def test_add_day_response_has_required_fields() -> None:
    """Created day response includes all Day model fields."""
    mock_sb = MagicMock()
    mock_sb.table.side_effect = lambda name: (
        _make_trip_chain() if name == "trips"
        else _make_days_chain([], INSERTED_DAY)
    )
    client = _make_client(mock_sb)
    body = client.post(
        f"/api/trips/{TRIP_ID}/itinerary/days",
        json={"position": 3, "date": "2026-06-21", "city": "New City", "day_type": "rest"},
        headers={"X-API-Key": API_KEY},
    ).json()
    for field in ("id", "trip_id", "position", "date", "city", "day_type", "activities"):
        assert field in body, f"missing field: {field}"


def test_add_day_shifts_existing_positions() -> None:
    """Days at position >= new_position are upserted with position + 1."""
    mock_sb = MagicMock()
    days_chain = _make_days_chain(
        affected_rows=[EXISTING_DAY_POS3],
        inserted_row=INSERTED_DAY,
    )

    mock_sb.table.side_effect = lambda name: (
        _make_trip_chain() if name == "trips" else days_chain
    )
    client = _make_client(mock_sb)
    client.post(
        f"/api/trips/{TRIP_ID}/itinerary/days",
        json={"position": 3, "date": "2026-06-21", "city": "New City", "day_type": "rest"},
        headers={"X-API-Key": API_KEY},
    )
    # Upsert must be called with the shifted rows.
    days_chain.upsert.assert_called_once()
    upsert_arg = days_chain.upsert.call_args[0][0]
    assert len(upsert_arg) == 1
    assert upsert_arg[0]["position"] == EXISTING_DAY_POS3["position"] + 1


def test_add_day_at_end_no_upsert() -> None:
    """Inserting after the last day (no affected rows) skips the upsert call."""
    mock_sb = MagicMock()
    days_chain = _make_days_chain(affected_rows=[], inserted_row=INSERTED_DAY)
    mock_sb.table.side_effect = lambda name: (
        _make_trip_chain() if name == "trips" else days_chain
    )
    client = _make_client(mock_sb)
    client.post(
        f"/api/trips/{TRIP_ID}/itinerary/days",
        json={"position": 6, "date": "2026-07-06", "city": "Rome", "day_type": "exploration"},
        headers={"X-API-Key": API_KEY},
    )
    days_chain.upsert.assert_not_called()


def test_add_day_404_trip_not_found() -> None:
    """Returns 404 when the trip does not exist."""
    mock_sb = MagicMock()
    mock_sb.table.side_effect = lambda name: (
        _make_trip_chain(found=False) if name == "trips"
        else _make_days_chain([], INSERTED_DAY)
    )
    client = _make_client(mock_sb)
    response = client.post(
        f"/api/trips/{TRIP_ID}/itinerary/days",
        json={"position": 1, "date": "2026-06-19", "city": "Paris", "day_type": "exploration"},
        headers={"X-API-Key": API_KEY},
    )
    assert response.status_code == 404


def test_add_day_requires_auth() -> None:
    """Returns 403 when X-API-Key header is absent (Supabase not reached)."""
    mock_sb = MagicMock()
    mock_sb.table.side_effect = lambda name: _make_trip_chain()
    client = _make_client(mock_sb)
    response = client.post(
        f"/api/trips/{TRIP_ID}/itinerary/days",
        json={"position": 1, "date": "2026-06-19", "city": "Paris", "day_type": "exploration"},
    )
    assert response.status_code == 403


# ── POST /api/trips/{trip_id}/itinerary/validate ──────────────────────────────

def _make_validate_supabase(days: list | None = None) -> MagicMock:
    """Build a Supabase mock that satisfies the validate route's three table reads."""
    mock_sb = MagicMock()

    def table_side_effect(name: str) -> MagicMock:
        chain = MagicMock()
        if name == "trips":
            chain.select.return_value.eq.return_value.execute.return_value.data = [
                {"id": TRIP_ID}
            ]
        elif name == "itinerary_days":
            chain.select.return_value.eq.return_value.execute.return_value.data = (
                days if days is not None else [EXISTING_DAY_POS3]
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


def test_validate_returns_200_with_status_and_message() -> None:
    """POST /validate returns 200 with status and message from Claude."""
    client = _make_client(_make_validate_supabase(), _make_claude_mock("ok", "Adding a day is fine."))
    response = client.post(
        f"/api/trips/{TRIP_ID}/itinerary/validate",
        json={"mutation_type": "add_day", "mutation_description": "Adding a rest day in Paris"},
        headers={"X-API-Key": API_KEY},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert isinstance(body["message"], str) and body["message"]


def test_validate_forwards_warning_status() -> None:
    """Validation results are not filtered — 'warning' passes through."""
    client = _make_client(
        _make_validate_supabase(),
        _make_claude_mock("warning", "Consider the pace impact."),
    )
    body = client.post(
        f"/api/trips/{TRIP_ID}/itinerary/validate",
        json={"mutation_type": "add_day", "mutation_description": "Adding a 4th consecutive busy day"},
        headers={"X-API-Key": API_KEY},
    ).json()
    assert body["status"] == "warning"


def test_validate_404_trip_not_found() -> None:
    """Returns 404 when the trip does not exist."""
    mock_sb = MagicMock()
    mock_sb.table.side_effect = lambda name: _make_trip_chain(found=False)
    client = _make_client(mock_sb)
    response = client.post(
        f"/api/trips/{TRIP_ID}/itinerary/validate",
        json={"mutation_type": "add_day", "mutation_description": "test"},
        headers={"X-API-Key": API_KEY},
    )
    assert response.status_code == 404


def test_validate_requires_auth() -> None:
    """Returns 403 when X-API-Key header is absent."""
    mock_sb = MagicMock()
    mock_sb.table.side_effect = lambda name: _make_trip_chain()
    client = _make_client(mock_sb)
    response = client.post(
        f"/api/trips/{TRIP_ID}/itinerary/validate",
        json={"mutation_type": "add_day", "mutation_description": "test"},
    )
    assert response.status_code == 403


def test_validate_claude_error_returns_502() -> None:
    """If Claude returns malformed JSON, route returns 502."""
    mock_claude = MagicMock()
    mock_claude.messages.create.return_value.content = [MagicMock(text="not valid json")]
    client = _make_client(_make_validate_supabase(), mock_claude)
    response = client.post(
        f"/api/trips/{TRIP_ID}/itinerary/validate",
        json={"mutation_type": "add_day", "mutation_description": "test"},
        headers={"X-API-Key": API_KEY},
    )
    assert response.status_code == 502
