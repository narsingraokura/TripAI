"""
Adversarial and edge-case tests for:
  DELETE /api/trips/{trip_id}/itinerary/days/{day_id}
  POST   /api/trips/{trip_id}/itinerary/validate
  POST   /api/trips/{trip_id}/itinerary/resolve

Supplement test_remove_day.py with cases the developer did not cover.
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
WRONG_KEY = "definitely-not-the-right-key"
DAY_ID = "day-uuid-edge-01"
ACTIVITY_ID = "act-uuid-edge-01"
OTHER_DAY_ID = "day-uuid-edge-02"


@pytest.fixture()
def trip_id() -> str:
    return os.environ.get("TRIP_ID", "550e8400-e29b-41d4-a716-446655440000")


# ── Factories ──────────────────────────────────────────────────────────────────

def _day_row(trip_id: str, day_id: str = DAY_ID, position: int = 9) -> dict:
    return {
        "id": day_id,
        "trip_id": trip_id,
        "position": position,
        "date": "2026-06-28",
        "city": "Interlaken",
        "country": "CH",
        "day_type": "exploration",
        "notes": "Lake Brienz",
        "title": "Interlaken",
        "plan": "Lake day",
        "intensity": "light",
        "is_special": False,
        "special_label": None,
        "created_at": TIMESTAMP,
        "updated_at": TIMESTAMP,
    }


def _activity_row(day_id: str = DAY_ID) -> dict:
    return {
        "id": ACTIVITY_ID,
        "day_id": day_id,
        "position": 1,
        "title": "Titlis Mountain",
        "time_slot": "morning",
        "specific_time": None,
        "category": "sightseeing",
        "estimated_cost": 120.0,
        "notes": None,
        "created_at": TIMESTAMP,
    }


def _build_delete_mock(
    trip_id: str,
    day_found: bool = True,
    higher_days: list | None = None,
    activities: list | None = None,
    position: int = 9,
) -> tuple[MagicMock, MagicMock, MagicMock]:
    row = _day_row(trip_id, position=position)
    highs = higher_days or []
    acts = activities or []

    trip_chain = MagicMock()
    trip_chain.select.return_value.eq.return_value.execute.return_value.data = [{"id": trip_id}]

    days_chain = MagicMock()
    days_chain.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = (
        [row] if day_found else []
    )
    days_chain.select.return_value.eq.return_value.gt.return_value.execute.return_value.data = highs
    days_chain.delete.return_value.eq.return_value.eq.return_value.execute.return_value.data = []
    days_chain.upsert.return_value.execute.return_value.data = []

    mutations_chain = MagicMock()
    mutations_chain.insert.return_value.execute.return_value.data = [{"id": "mut-edge-uuid"}]

    acts_chain = MagicMock()
    acts_chain.select.return_value.eq.return_value.execute.return_value.data = acts

    chains: dict[str, MagicMock] = {
        "trips": trip_chain,
        "itinerary_days": days_chain,
        "itinerary_mutations": mutations_chain,
        "itinerary_activities": acts_chain,
    }
    mock_sb = MagicMock()
    mock_sb.table.side_effect = lambda name: chains.get(name, MagicMock())
    return mock_sb, days_chain, mutations_chain


def _make_client(mock_sb: MagicMock) -> TestClient:
    app.dependency_overrides[itinerary_get_supabase] = lambda: mock_sb
    return TestClient(app)


def teardown_function() -> None:
    app.dependency_overrides.clear()


# ── Auth: wrong key value (not just missing) ──────────────────────────────────

def test_remove_day_wrong_api_key_value_returns_403(trip_id: str) -> None:
    """A wrong (non-empty) X-API-Key value must be rejected with 403.
    Distinct from the missing-key test: hmac.compare_digest must reject both."""
    mock_sb, _, _ = _build_delete_mock(trip_id)
    response = _make_client(mock_sb).delete(
        f"/api/trips/{trip_id}/itinerary/days/{DAY_ID}",
        headers={"X-API-Key": WRONG_KEY},
    )
    assert response.status_code == 403


def test_resolve_wrong_api_key_value_returns_403(trip_id: str) -> None:
    """A wrong (non-empty) X-API-Key value on resolve returns 403."""
    trip_chain = MagicMock()
    trip_chain.select.return_value.eq.return_value.execute.return_value.data = [{"id": trip_id}]
    mock_sb = MagicMock()
    mock_sb.table.return_value = trip_chain

    response = _make_client(mock_sb).post(
        f"/api/trips/{trip_id}/itinerary/resolve",
        json={
            "suggestion_id": "s-1",
            "suggestion_payload": {
                "action": "move_activity",
                "activity_id": ACTIVITY_ID,
                "to_day_id": OTHER_DAY_ID,
            },
        },
        headers={"X-API-Key": WRONG_KEY},
    )
    assert response.status_code == 403


# ── Mutation log: position field matches deleted day ──────────────────────────

def test_remove_day_mutation_log_records_correct_position(trip_id: str) -> None:
    """payload_before must record the exact position of the deleted day.
    Formula assertion: position in log == deleted_position, not a hardcoded scalar."""
    target_position = 9
    mock_sb, _, mutations_chain = _build_delete_mock(trip_id, position=target_position)
    _make_client(mock_sb).delete(
        f"/api/trips/{trip_id}/itinerary/days/{DAY_ID}",
        headers={"X-API-Key": API_KEY},
    )
    insert_arg = mutations_chain.insert.call_args[0][0]
    logged_position = insert_arg["payload_before"]["position"]
    assert logged_position == target_position, (
        f"Mutation log recorded position {logged_position}, expected {target_position}"
    )


# ── Position re-index: upsert rows sorted ascending ──────────────────────────

def test_remove_day_upsert_positions_sorted_ascending(trip_id: str) -> None:
    """Re-indexed rows must be upserted with the LOWEST new position first.
    This prevents unique-constraint collisions: the vacant slot (just deleted)
    is filled before higher slots shift into it.
    Formula assertion: positions list == sorted(positions list)."""
    # Provide mock higher days in non-ascending input order to expose any missing sort.
    highs = [
        _day_row(trip_id, "day-pos-12", position=12),
        _day_row(trip_id, "day-pos-10", position=10),
        _day_row(trip_id, "day-pos-11", position=11),
    ]
    mock_sb, days_chain, _ = _build_delete_mock(trip_id, higher_days=highs, position=9)
    _make_client(mock_sb).delete(
        f"/api/trips/{trip_id}/itinerary/days/{DAY_ID}",
        headers={"X-API-Key": API_KEY},
    )
    days_chain.upsert.assert_called_once()
    upsert_arg = days_chain.upsert.call_args[0][0]
    positions = [row["position"] for row in upsert_arg]
    # Formula: positions must equal their own sorted version (ascending)
    assert positions == sorted(positions), (
        f"Upsert payload not sorted ascending: {positions}. "
        "Decrement-shift must process the lowest new position first."
    )


# ── Validate: guard conditions for suggestion generation ─────────────────────

def _build_validate_mock_violation(trip_id: str) -> MagicMock:
    """Mock with a must_visit constraint — suggestions would be generated IF the guard passes."""
    trip_chain = MagicMock()
    trip_chain.select.return_value.eq.return_value.execute.return_value.data = [{"id": trip_id}]

    days_chain = MagicMock()
    days_chain.select.return_value.eq.return_value.execute.return_value.data = [
        _day_row(trip_id, DAY_ID, 9),
        _day_row(trip_id, OTHER_DAY_ID, 8),
    ]

    acts_chain = MagicMock()
    acts_chain.select.return_value.in_.return_value.execute.return_value.data = [
        _activity_row(DAY_ID)
    ]

    goals_chain = MagicMock()
    goals_chain.select.return_value.eq.return_value.execute.return_value.data = []

    constraints_chain = MagicMock()
    constraints_chain.select.return_value.eq.return_value.execute.return_value.data = [
        {
            "id": "con-edge-1",
            "trip_id": trip_id,
            "constraint_type": "must_visit",
            "description": "Titlis Mountain",
            "value": None,
            "created_at": TIMESTAMP,
        }
    ]

    chains: dict[str, MagicMock] = {
        "trips": trip_chain,
        "itinerary_days": days_chain,
        "itinerary_activities": acts_chain,
        "trip_goals": goals_chain,
        "trip_constraints": constraints_chain,
    }
    mock_sb = MagicMock()
    mock_sb.table.side_effect = lambda name: chains.get(name, MagicMock())
    return mock_sb


def _claude_violation_mock() -> MagicMock:
    mock_claude = MagicMock()
    payload = json.dumps({"status": "violation", "message": "Violates must-visit."})
    mock_claude.messages.create.return_value.content = [MagicMock(text=payload)]
    return mock_claude


def test_validate_no_suggestions_when_day_id_omitted(trip_id: str) -> None:
    """Suggestions must be empty when day_id is absent.
    The guard `if body.day_id and body.day_activities` requires BOTH fields.
    Even a real constraint and matching activities produce no suggestions without day_id."""
    mock_sb = _build_validate_mock_violation(trip_id)
    mock_claude = _claude_violation_mock()
    app.dependency_overrides[itinerary_get_supabase] = lambda: mock_sb
    app.dependency_overrides[itinerary_get_anthropic] = lambda: mock_claude

    response = TestClient(app).post(
        f"/api/trips/{trip_id}/itinerary/validate",
        json={
            "mutation_type": "remove_day",
            "mutation_description": "Removing Interlaken day",
            # day_id intentionally omitted
            "day_activities": ["Titlis Mountain"],
        },
        headers={"X-API-Key": API_KEY},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "violation"
    assert body.get("suggestions", []) == [], (
        "suggestions must be [] when day_id is absent — guard requires both fields"
    )


def test_validate_no_suggestions_when_day_activities_omitted(trip_id: str) -> None:
    """Suggestions must be empty when day_activities is absent.
    The guard `if body.day_id and body.day_activities` treats None as falsy."""
    mock_sb = _build_validate_mock_violation(trip_id)
    mock_claude = _claude_violation_mock()
    app.dependency_overrides[itinerary_get_supabase] = lambda: mock_sb
    app.dependency_overrides[itinerary_get_anthropic] = lambda: mock_claude

    response = TestClient(app).post(
        f"/api/trips/{trip_id}/itinerary/validate",
        json={
            "mutation_type": "remove_day",
            "mutation_description": "Removing Interlaken day",
            "day_id": DAY_ID,
            # day_activities intentionally omitted
        },
        headers={"X-API-Key": API_KEY},
    )
    assert response.status_code == 200
    body = response.json()
    assert body.get("suggestions", []) == [], (
        "suggestions must be [] when day_activities is absent — guard requires both fields"
    )


# ── Resolve: empty payload → 422 ─────────────────────────────────────────────

def test_resolve_empty_payload_returns_422(trip_id: str) -> None:
    """An empty suggestion_payload dict has no 'action' key.
    payload.get('action') returns None, which hits the else branch → 422."""
    trip_chain = MagicMock()
    trip_chain.select.return_value.eq.return_value.execute.return_value.data = [{"id": trip_id}]
    mock_sb = MagicMock()
    mock_sb.table.return_value = trip_chain

    response = _make_client(mock_sb).post(
        f"/api/trips/{trip_id}/itinerary/resolve",
        json={
            "suggestion_id": "s-1",
            "suggestion_payload": {},
        },
        headers={"X-API-Key": API_KEY},
    )
    assert response.status_code == 422
    assert "Unknown action" in response.json()["detail"]
