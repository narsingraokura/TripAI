"""
Tests for:
  DELETE /api/trips/{trip_id}/itinerary/days/{day_id}  — delete + re-index + mutation log
  POST   /api/trips/{trip_id}/itinerary/resolve        — apply a concrete suggestion payload
  POST   /api/trips/{trip_id}/itinerary/validate       — suggestions included on violation
"""
import json
import os
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.routers.itinerary import get_supabase as itinerary_get_supabase
from main import app

TIMESTAMP = "2026-04-24T00:00:00+00:00"
API_KEY = "test-key-12345"
DAY_ID = "day-uuid-05"
ACTIVITY_ID = "act-uuid-01"
OTHER_DAY_ID = "day-uuid-06"


@pytest.fixture()
def trip_id() -> str:
    return os.environ.get("TRIP_ID", "550e8400-e29b-41d4-a716-446655440000")


# ── Factories ──────────────────────────────────────────────────────────────────

def _day_row(trip_id: str, day_id: str = DAY_ID, position: int = 5) -> dict:
    return {
        "id": day_id,
        "trip_id": trip_id,
        "position": position,
        "date": "2026-06-23",
        "city": "Paris",
        "country": "France",
        "day_type": "exploration",
        "notes": "Eiffel Tower",
        "title": "Paris",
        "plan": "Visit Eiffel Tower",
        "intensity": "busy",
        "is_special": False,
        "special_label": None,
        "created_at": TIMESTAMP,
        "updated_at": TIMESTAMP,
    }


def _day_at_pos(trip_id: str, position: int) -> dict:
    return {
        **_day_row(trip_id, f"day-uuid-{position:02d}", position),
        "city": f"City{position}",
    }


def _activity_row(day_id: str = DAY_ID) -> dict:
    return {
        "id": ACTIVITY_ID,
        "day_id": day_id,
        "position": 1,
        "title": "Eiffel Tower visit",
        "time_slot": "morning",
        "specific_time": None,
        "category": "sightseeing",
        "estimated_cost": 25.0,
        "notes": None,
        "created_at": TIMESTAMP,
    }


def _make_client(mock_sb: MagicMock) -> TestClient:
    app.dependency_overrides[itinerary_get_supabase] = lambda: mock_sb
    return TestClient(app)


def teardown_function() -> None:
    app.dependency_overrides.clear()


# ── Delete mock ────────────────────────────────────────────────────────────────

def _build_delete_mock(
    trip_id: str,
    day_found: bool = True,
    higher_days: list | None = None,
    activities: list | None = None,
) -> tuple[MagicMock, MagicMock, MagicMock]:
    """
    Returns (mock_sb, days_chain, mutations_chain).

    days_chain wires two distinct select paths using MagicMock attribute chains:
      - .select("*").eq("id", ...).eq("trip_id", ...).execute()  → day lookup (eq→eq chain)
      - .select("*").eq("trip_id", ...).gt("position", ...).execute() → re-index query (eq→gt chain)

    Because the second chained call differs (.eq vs .gt), MagicMock returns different
    return_value objects for each path without needing call-count tricks.
    """
    row = _day_row(trip_id)
    highs = higher_days or []
    acts = activities or []

    trip_chain = MagicMock()
    trip_chain.select.return_value.eq.return_value.execute.return_value.data = [{"id": trip_id}]

    days_chain = MagicMock()
    # Path 1: select("*").eq("id").eq("trip_id").execute() — fetch the specific day
    days_chain.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = (
        [row] if day_found else []
    )
    # Path 2: select("*").eq("trip_id").gt("position").execute() — fetch higher-position days
    days_chain.select.return_value.eq.return_value.gt.return_value.execute.return_value.data = highs
    days_chain.delete.return_value.eq.return_value.eq.return_value.execute.return_value.data = []
    days_chain.upsert.return_value.execute.return_value.data = []

    mutations_chain = MagicMock()
    mutations_chain.insert.return_value.execute.return_value.data = [{"id": "mut-uuid"}]

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


# ── DELETE /api/trips/{trip_id}/itinerary/days/{day_id} ───────────────────────

def test_remove_day_returns_204(trip_id: str) -> None:
    """Happy path: DELETE returns 204 No Content."""
    mock_sb, _, _ = _build_delete_mock(trip_id)
    response = _make_client(mock_sb).delete(
        f"/api/trips/{trip_id}/itinerary/days/{DAY_ID}",
        headers={"X-API-Key": API_KEY},
    )
    assert response.status_code == 204
    assert response.content == b""


def test_remove_day_404_trip_not_found(trip_id: str) -> None:
    """Returns 404 when the trip does not exist."""
    mock_sb = MagicMock()
    trip_chain = MagicMock()
    trip_chain.select.return_value.eq.return_value.execute.return_value.data = []
    mock_sb.table.return_value = trip_chain
    response = _make_client(mock_sb).delete(
        f"/api/trips/{trip_id}/itinerary/days/{DAY_ID}",
        headers={"X-API-Key": API_KEY},
    )
    assert response.status_code == 404


def test_remove_day_404_day_not_found(trip_id: str) -> None:
    """Returns 404 when the day does not belong to the trip."""
    mock_sb, _, _ = _build_delete_mock(trip_id, day_found=False)
    response = _make_client(mock_sb).delete(
        f"/api/trips/{trip_id}/itinerary/days/{DAY_ID}",
        headers={"X-API-Key": API_KEY},
    )
    assert response.status_code == 404


def test_remove_day_requires_auth(trip_id: str) -> None:
    """Returns 403 when X-API-Key header is absent."""
    mock_sb, _, _ = _build_delete_mock(trip_id)
    response = _make_client(mock_sb).delete(
        f"/api/trips/{trip_id}/itinerary/days/{DAY_ID}",
    )
    assert response.status_code == 403


def test_remove_day_decrements_higher_positions(trip_id: str) -> None:
    """Days with position > deleted day's position are upserted with position - 1."""
    highs = [_day_at_pos(trip_id, p) for p in [6, 7, 8]]
    mock_sb, days_chain, _ = _build_delete_mock(trip_id, higher_days=highs)
    _make_client(mock_sb).delete(
        f"/api/trips/{trip_id}/itinerary/days/{DAY_ID}",
        headers={"X-API-Key": API_KEY},
    )
    days_chain.upsert.assert_called_once()
    upsert_arg = days_chain.upsert.call_args[0][0]
    assert len(upsert_arg) == 3
    shifted_positions = {row["position"] for row in upsert_arg}
    assert shifted_positions == {5, 6, 7}


def test_remove_day_no_upsert_when_last_day(trip_id: str) -> None:
    """Deleting the last day (no higher positions) does not trigger a re-index upsert."""
    mock_sb, days_chain, _ = _build_delete_mock(trip_id, higher_days=[])
    _make_client(mock_sb).delete(
        f"/api/trips/{trip_id}/itinerary/days/{DAY_ID}",
        headers={"X-API-Key": API_KEY},
    )
    days_chain.upsert.assert_not_called()


def test_remove_day_logs_mutation(trip_id: str) -> None:
    """DELETE route logs payload_before with the day row and its activities embedded."""
    acts = [_activity_row(DAY_ID)]
    mock_sb, _, mutations_chain = _build_delete_mock(trip_id, activities=acts)
    _make_client(mock_sb).delete(
        f"/api/trips/{trip_id}/itinerary/days/{DAY_ID}",
        headers={"X-API-Key": API_KEY},
    )
    mutations_chain.insert.assert_called_once()
    insert_arg = mutations_chain.insert.call_args[0][0]
    assert insert_arg["trip_id"] == trip_id
    assert insert_arg["mutation_type"] == "remove_day"
    assert insert_arg["payload_before"]["id"] == DAY_ID
    assert insert_arg["payload_before"]["activities"] == acts


# ── POST /api/trips/{trip_id}/itinerary/resolve ───────────────────────────────

def _build_resolve_mock(trip_id: str) -> MagicMock:
    """Wire a Supabase mock for the resolve route (move_activity action)."""
    trip_chain = MagicMock()
    trip_chain.select.return_value.eq.return_value.execute.return_value.data = [{"id": trip_id}]

    acts_chain = MagicMock()
    acts_chain.update.return_value.eq.return_value.execute.return_value.data = [
        _activity_row(OTHER_DAY_ID)
    ]
    # For the itinerary re-fetch after resolve (in_("day_id", [...]))
    acts_chain.select.return_value.in_.return_value.execute.return_value.data = []

    days_chain = MagicMock()
    days_chain.select.return_value.eq.return_value.execute.return_value.data = [
        _day_row(trip_id, OTHER_DAY_ID, position=6),
        _day_row(trip_id, "day-uuid-07", position=7),
    ]

    goals_chain = MagicMock()
    goals_chain.select.return_value.eq.return_value.execute.return_value.data = []

    constraints_chain = MagicMock()
    constraints_chain.select.return_value.eq.return_value.execute.return_value.data = []

    chains: dict[str, MagicMock] = {
        "trips": trip_chain,
        "itinerary_activities": acts_chain,
        "itinerary_days": days_chain,
        "trip_goals": goals_chain,
        "trip_constraints": constraints_chain,
    }
    mock_sb = MagicMock()
    mock_sb.table.side_effect = lambda name: chains.get(name, MagicMock())
    return mock_sb


def test_resolve_returns_updated_itinerary(trip_id: str) -> None:
    """POST /resolve returns 200 with the full updated itinerary (days, goals, constraints)."""
    mock_sb = _build_resolve_mock(trip_id)
    response = _make_client(mock_sb).post(
        f"/api/trips/{trip_id}/itinerary/resolve",
        json={
            "suggestion_id": "s-1",
            "suggestion_payload": {
                "action": "move_activity",
                "activity_id": ACTIVITY_ID,
                "from_day_id": DAY_ID,
                "to_day_id": OTHER_DAY_ID,
            },
        },
        headers={"X-API-Key": API_KEY},
    )
    assert response.status_code == 200
    body = response.json()
    for field in ("days", "goals", "constraints"):
        assert field in body, f"missing field: {field}"


def test_resolve_calls_update_on_activity(trip_id: str) -> None:
    """Resolve with move_activity updates itinerary_activities.day_id to the target day."""
    mock_sb = _build_resolve_mock(trip_id)
    # Capture the acts chain before the request.
    acts_chain = mock_sb.table("itinerary_activities")
    _make_client(mock_sb).post(
        f"/api/trips/{trip_id}/itinerary/resolve",
        json={
            "suggestion_id": "s-1",
            "suggestion_payload": {
                "action": "move_activity",
                "activity_id": ACTIVITY_ID,
                "from_day_id": DAY_ID,
                "to_day_id": OTHER_DAY_ID,
            },
        },
        headers={"X-API-Key": API_KEY},
    )
    acts_chain.update.assert_called_once_with({"day_id": OTHER_DAY_ID})


def test_resolve_requires_auth(trip_id: str) -> None:
    """Returns 403 when X-API-Key is absent."""
    mock_sb = _build_resolve_mock(trip_id)
    response = _make_client(mock_sb).post(
        f"/api/trips/{trip_id}/itinerary/resolve",
        json={
            "suggestion_id": "s-1",
            "suggestion_payload": {"action": "move_activity", "activity_id": ACTIVITY_ID,
                                   "from_day_id": DAY_ID, "to_day_id": OTHER_DAY_ID},
        },
    )
    assert response.status_code == 403


def test_resolve_404_trip_not_found(trip_id: str) -> None:
    """Returns 404 when the trip does not exist."""
    mock_sb = MagicMock()
    trip_chain = MagicMock()
    trip_chain.select.return_value.eq.return_value.execute.return_value.data = []
    mock_sb.table.return_value = trip_chain
    response = _make_client(mock_sb).post(
        f"/api/trips/{trip_id}/itinerary/resolve",
        json={
            "suggestion_id": "s-1",
            "suggestion_payload": {"action": "move_activity", "activity_id": ACTIVITY_ID,
                                   "from_day_id": DAY_ID, "to_day_id": OTHER_DAY_ID},
        },
        headers={"X-API-Key": API_KEY},
    )
    assert response.status_code == 404


# ── Validate — suggestions on violation ───────────────────────────────────────

def _build_validate_mock_with_constraints(trip_id: str) -> MagicMock:
    """Wire validate mock: trip found, one must_visit constraint matching an activity."""
    adjacent_day = _day_row(trip_id, OTHER_DAY_ID, position=4)
    day = _day_row(trip_id, DAY_ID, position=5)
    activity = _activity_row(DAY_ID)

    trip_chain = MagicMock()
    trip_chain.select.return_value.eq.return_value.execute.return_value.data = [{"id": trip_id}]

    days_chain = MagicMock()
    days_chain.select.return_value.eq.return_value.execute.return_value.data = [adjacent_day, day]

    acts_chain = MagicMock()
    acts_chain.select.return_value.in_.return_value.execute.return_value.data = [activity]

    goals_chain = MagicMock()
    goals_chain.select.return_value.eq.return_value.execute.return_value.data = []

    constraints_chain = MagicMock()
    constraints_chain.select.return_value.eq.return_value.execute.return_value.data = [
        {
            "id": "con-uuid-1",
            "trip_id": trip_id,
            "constraint_type": "must_visit",
            "description": "Eiffel Tower visit",
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


def _make_claude_mock(status: str = "violation", message: str = "Removing a must-visit.") -> MagicMock:
    mock_claude = MagicMock()
    payload = json.dumps({"status": status, "message": message})
    mock_claude.messages.create.return_value.content = [MagicMock(text=payload)]
    return mock_claude


def test_validate_includes_suggestions_on_violation_with_must_visit(trip_id: str) -> None:
    """When status=violation and day_activities includes a must_visit activity,
    the response includes suggestions with a move_activity payload."""
    from app.routers.itinerary import get_anthropic as itinerary_get_anthropic

    mock_sb = _build_validate_mock_with_constraints(trip_id)
    mock_claude = _make_claude_mock("violation", "Removing a must-visit activity.")
    app.dependency_overrides[itinerary_get_supabase] = lambda: mock_sb
    app.dependency_overrides[itinerary_get_anthropic] = lambda: mock_claude

    response = TestClient(app).post(
        f"/api/trips/{trip_id}/itinerary/validate",
        json={
            "mutation_type": "remove_day",
            "mutation_description": "Removing Paris day",
            "day_id": DAY_ID,
            "day_activities": ["Eiffel Tower visit"],
        },
        headers={"X-API-Key": API_KEY},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "violation"
    suggestions = body.get("suggestions", [])
    assert len(suggestions) > 0
    first = suggestions[0]
    assert first["payload"]["action"] == "move_activity"
    assert first["payload"]["activity_id"] == ACTIVITY_ID


def test_validate_no_suggestions_when_ok(trip_id: str) -> None:
    """When status=ok, suggestions list is empty."""
    from app.routers.itinerary import get_anthropic as itinerary_get_anthropic

    mock_sb = _build_validate_mock_with_constraints(trip_id)
    mock_claude = _make_claude_mock("ok", "Looks fine.")
    app.dependency_overrides[itinerary_get_supabase] = lambda: mock_sb
    app.dependency_overrides[itinerary_get_anthropic] = lambda: mock_claude

    response = TestClient(app).post(
        f"/api/trips/{trip_id}/itinerary/validate",
        json={
            "mutation_type": "remove_day",
            "mutation_description": "Removing a non-constrained day",
            "day_id": DAY_ID,
            "day_activities": [],
        },
        headers={"X-API-Key": API_KEY},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body.get("suggestions", []) == []


# ── Resolve — 422 error paths ─────────────────────────────────────────────────

def test_resolve_unknown_action_returns_422(trip_id: str) -> None:
    """POST /resolve with an unrecognised action name returns 422."""
    mock_sb = _build_resolve_mock(trip_id)
    response = _make_client(mock_sb).post(
        f"/api/trips/{trip_id}/itinerary/resolve",
        json={
            "suggestion_id": "s-1",
            "suggestion_payload": {"action": "unknown_action"},
        },
        headers={"X-API-Key": API_KEY},
    )
    assert response.status_code == 422


def test_resolve_missing_activity_id_returns_422(trip_id: str) -> None:
    """POST /resolve with move_activity but no activity_id returns 422."""
    mock_sb = _build_resolve_mock(trip_id)
    response = _make_client(mock_sb).post(
        f"/api/trips/{trip_id}/itinerary/resolve",
        json={
            "suggestion_id": "s-1",
            "suggestion_payload": {
                "action": "move_activity",
                "to_day_id": OTHER_DAY_ID,
            },
        },
        headers={"X-API-Key": API_KEY},
    )
    assert response.status_code == 422


def test_resolve_missing_to_day_id_returns_422(trip_id: str) -> None:
    """POST /resolve with move_activity but no to_day_id returns 422."""
    mock_sb = _build_resolve_mock(trip_id)
    response = _make_client(mock_sb).post(
        f"/api/trips/{trip_id}/itinerary/resolve",
        json={
            "suggestion_id": "s-1",
            "suggestion_payload": {
                "action": "move_activity",
                "activity_id": ACTIVITY_ID,
            },
        },
        headers={"X-API-Key": API_KEY},
    )
    assert response.status_code == 422
