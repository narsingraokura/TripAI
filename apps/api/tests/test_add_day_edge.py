"""
Edge-case tests for:
  POST /api/trips/{trip_id}/itinerary/days  — position-based insert with re-indexing
  POST /api/trips/{trip_id}/itinerary/validate — AI-powered mutation validation

Covers gaps NOT addressed in test_add_day.py:
  - Multi-row shift (reviewer-requested: positions 3,4,5,6,7)
  - Upsert payload sorted descending (UNIQUE constraint safety)
  - Insert at position 1 shifts all 17 existing days
  - Insert at position 9 shifts only positions 9-17
  - Insert at position 18 (end of trip) — no upsert needed
  - Insert into an empty itinerary — position 1, no upsert
  - Empty city string — backend accepts it with fallback title "New day"
"""
import os
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.routers.itinerary import get_supabase as itinerary_get_supabase
from main import app

TIMESTAMP = "2026-04-24T00:00:00+00:00"
API_KEY = "test-key-12345"


@pytest.fixture()
def trip_id() -> str:
    return os.environ.get("TRIP_ID", "550e8400-e29b-41d4-a716-446655440000")


# ── Factories ──────────────────────────────────────────────────────────────────

def _day_at_pos(trip_id: str, position: int) -> dict:
    return {
        "id": f"day-uuid-{position:03d}",
        "trip_id": trip_id,
        "position": position,
        "date": "2026-06-20",  # static placeholder — Supabase is mocked
        "city": f"City{position}",
        "country": "",
        "day_type": "exploration",
        "notes": None,
        "title": f"Day {position}",
        "plan": "",
        "intensity": "moderate",
        "is_special": False,
        "special_label": None,
        "created_at": TIMESTAMP,
        "updated_at": TIMESTAMP,
    }


def _inserted_day(trip_id: str, position: int = 1, city: str = "New City") -> dict:
    return {
        "id": "day-uuid-new",
        "trip_id": trip_id,
        "position": position,
        "date": "2026-06-20",
        "city": city,
        "country": "",
        "day_type": "rest",
        "notes": None,
        "title": city or "New day",
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


def _make_days_chain(affected_rows: list, inserted_row: dict) -> MagicMock:
    """Wire up the days-table mock for select / upsert / insert."""
    chain = MagicMock()

    affected = MagicMock()
    affected.data = affected_rows
    chain.select.return_value.eq.return_value.gte.return_value.execute.return_value = affected

    upserted = MagicMock()
    upserted.data = [{**r, "position": r["position"] + 1} for r in affected_rows]
    chain.upsert.return_value.execute.return_value = upserted

    inserted = MagicMock()
    inserted.data = [inserted_row]
    chain.insert.return_value.execute.return_value = inserted

    return chain


def _make_client(mock_sb: MagicMock) -> TestClient:
    app.dependency_overrides[itinerary_get_supabase] = lambda: mock_sb
    return TestClient(app)


def teardown_function() -> None:
    app.dependency_overrides.clear()


# ── Multi-row shift (reviewer-requested) ─────────────────────────────────────

def test_multi_row_shift_reviewer_request_positions_3_through_7(trip_id: str) -> None:
    """Reviewer-requested: positions 3,4,5,6,7 all shift to 4,5,6,7,8 when inserting at 3."""
    existing = [_day_at_pos(trip_id, p) for p in [3, 4, 5, 6, 7]]
    mock_sb = MagicMock()
    days_chain = _make_days_chain(existing, _inserted_day(trip_id, position=3))
    mock_sb.table.side_effect = lambda name: (
        _make_trip_chain(trip_id) if name == "trips" else days_chain
    )
    client = _make_client(mock_sb)
    client.post(
        f"/api/trips/{trip_id}/itinerary/days",
        json={"position": 3, "date": "2026-06-21", "city": "New City", "day_type": "rest"},
        headers={"X-API-Key": API_KEY},
    )
    days_chain.upsert.assert_called_once()
    upsert_arg = days_chain.upsert.call_args[0][0]
    assert len(upsert_arg) == 5
    shifted_positions = {row["position"] for row in upsert_arg}
    assert shifted_positions == {4, 5, 6, 7, 8}


def test_multi_row_shift_sorted_descending(trip_id: str) -> None:
    """Upsert payload is sorted descending — prevents UNIQUE(trip_id, position) mid-batch violation.

    Without descending sort, inserting at position 3 when [3,4] exist would try to move
    row-3 to 4 while row-4 still occupies 4, causing a unique-constraint error before row-4
    has a chance to shift. Descending order processes the highest position first.
    """
    existing = [_day_at_pos(trip_id, p) for p in [3, 4, 5, 6, 7]]
    mock_sb = MagicMock()
    days_chain = _make_days_chain(existing, _inserted_day(trip_id, position=3))
    mock_sb.table.side_effect = lambda name: (
        _make_trip_chain(trip_id) if name == "trips" else days_chain
    )
    _make_client(mock_sb).post(
        f"/api/trips/{trip_id}/itinerary/days",
        json={"position": 3, "date": "2026-06-21", "city": "New City", "day_type": "rest"},
        headers={"X-API-Key": API_KEY},
    )
    upsert_arg = days_chain.upsert.call_args[0][0]
    positions = [row["position"] for row in upsert_arg]
    assert positions == sorted(positions, reverse=True), (
        "upsert payload must be descending to avoid UNIQUE constraint mid-batch violation"
    )


# ── Full-scale shift (position 1 of 17 days) ─────────────────────────────────

def test_insert_at_position_1_shifts_all_17_days(trip_id: str) -> None:
    """Insert at the start of a 17-day trip — all 17 days must shift to positions 2–18."""
    existing = [_day_at_pos(trip_id, p) for p in range(1, 18)]
    mock_sb = MagicMock()
    days_chain = _make_days_chain(existing, _inserted_day(trip_id, position=1, city="Pre-Trip"))
    mock_sb.table.side_effect = lambda name: (
        _make_trip_chain(trip_id) if name == "trips" else days_chain
    )
    resp = _make_client(mock_sb).post(
        f"/api/trips/{trip_id}/itinerary/days",
        json={"position": 1, "date": "2026-06-18", "city": "Pre-Trip", "day_type": "rest"},
        headers={"X-API-Key": API_KEY},
    )
    assert resp.status_code == 201
    days_chain.upsert.assert_called_once()
    upsert_arg = days_chain.upsert.call_args[0][0]
    assert len(upsert_arg) == 17
    shifted_positions = {row["position"] for row in upsert_arg}
    assert shifted_positions == set(range(2, 19))


# ── Partial shift (position 9 of 17 days) ────────────────────────────────────

def test_insert_at_position_9_shifts_positions_9_through_17(trip_id: str) -> None:
    """Insert at position 9 — only positions 9-17 shift (to 10-18); positions 1-8 are unaffected."""
    # The backend queries position >= 9, so the mock provides only those rows.
    affected = [_day_at_pos(trip_id, p) for p in range(9, 18)]
    mock_sb = MagicMock()
    days_chain = _make_days_chain(affected, _inserted_day(trip_id, position=9, city="Middle"))
    mock_sb.table.side_effect = lambda name: (
        _make_trip_chain(trip_id) if name == "trips" else days_chain
    )
    resp = _make_client(mock_sb).post(
        f"/api/trips/{trip_id}/itinerary/days",
        json={"position": 9, "date": "2026-06-27", "city": "Middle", "day_type": "exploration"},
        headers={"X-API-Key": API_KEY},
    )
    assert resp.status_code == 201
    days_chain.upsert.assert_called_once()
    upsert_arg = days_chain.upsert.call_args[0][0]
    # Positions 9–17 = 9 rows, each shifted to 10–18.
    assert len(upsert_arg) == 9
    shifted_positions = {row["position"] for row in upsert_arg}
    assert shifted_positions == set(range(10, 19))


# ── No-shift cases ────────────────────────────────────────────────────────────

def test_insert_at_position_18_after_full_trip_no_upsert(trip_id: str) -> None:
    """Insert after the last of 17 days (position 18) — no affected rows, upsert not called."""
    mock_sb = MagicMock()
    days_chain = _make_days_chain([], _inserted_day(trip_id, position=18, city="Rome"))
    mock_sb.table.side_effect = lambda name: (
        _make_trip_chain(trip_id) if name == "trips" else days_chain
    )
    resp = _make_client(mock_sb).post(
        f"/api/trips/{trip_id}/itinerary/days",
        json={"position": 18, "date": "2026-07-06", "city": "Rome", "day_type": "exploration"},
        headers={"X-API-Key": API_KEY},
    )
    assert resp.status_code == 201
    days_chain.upsert.assert_not_called()


def test_insert_position_1_into_empty_itinerary_no_upsert(trip_id: str) -> None:
    """Empty itinerary: insert at position 1 — no rows to shift, upsert not called."""
    mock_sb = MagicMock()
    days_chain = _make_days_chain([], _inserted_day(trip_id, position=1, city="London"))
    mock_sb.table.side_effect = lambda name: (
        _make_trip_chain(trip_id) if name == "trips" else days_chain
    )
    resp = _make_client(mock_sb).post(
        f"/api/trips/{trip_id}/itinerary/days",
        json={"position": 1, "date": "2026-06-19", "city": "London", "day_type": "exploration"},
        headers={"X-API-Key": API_KEY},
    )
    assert resp.status_code == 201
    assert resp.json()["position"] == 1
    days_chain.upsert.assert_not_called()


# ── Input edge cases ──────────────────────────────────────────────────────────

def test_add_day_empty_city_accepted_with_fallback_title(trip_id: str) -> None:
    """Empty city string passes Pydantic validation; backend uses 'New day' as fallback title.

    Frontend form prevents submission when city is blank (AddDayInlineForm handles that layer).
    At the API layer, an empty city string is accepted and the title is substituted.
    """
    mock_sb = MagicMock()
    empty_city_row = _inserted_day(trip_id, position=1, city="")
    empty_city_row["title"] = "New day"
    days_chain = _make_days_chain([], empty_city_row)
    mock_sb.table.side_effect = lambda name: (
        _make_trip_chain(trip_id) if name == "trips" else days_chain
    )
    resp = _make_client(mock_sb).post(
        f"/api/trips/{trip_id}/itinerary/days",
        json={"position": 1, "date": "2026-06-19", "city": "", "day_type": "exploration"},
        headers={"X-API-Key": API_KEY},
    )
    assert resp.status_code == 201
    # Verify the INSERT payload sent to Supabase uses the fallback title.
    insert_payload = days_chain.insert.call_args[0][0]
    assert insert_payload["city"] == ""
    assert insert_payload["title"] == "New day"
