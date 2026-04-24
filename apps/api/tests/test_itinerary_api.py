from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.routers.itinerary import get_supabase as itinerary_get_supabase
from main import app

TRIP_ID = "550e8400-e29b-41d4-a716-446655440000"
GOAL_ID = "goal-uuid-1"
GOAL_ID_2 = "goal-uuid-2"
CONSTRAINT_ID = "constraint-uuid-1"

MOCK_GOAL = {
    "id": GOAL_ID,
    "trip_id": TRIP_ID,
    "goal_type": "preset",
    "label": "Cultural immersion",
    "created_at": "2026-04-23T00:00:00+00:00",
}

MOCK_GOAL_2 = {
    "id": GOAL_ID_2,
    "trip_id": TRIP_ID,
    "goal_type": "custom",
    "label": "Visit family friends",
    "created_at": "2026-04-23T00:00:00+00:00",
}

MOCK_CONSTRAINT = {
    "id": CONSTRAINT_ID,
    "trip_id": TRIP_ID,
    "constraint_type": "must_visit",
    "description": "Must visit the Eiffel Tower",
    "value": None,
    "created_at": "2026-04-23T00:00:00+00:00",
}


# ── Mock helpers ──────────────────────────────────────────────────────────────

def _make_trip_chain(trip_found: bool = True) -> MagicMock:
    chain = MagicMock()
    response = MagicMock()
    response.data = [{"id": TRIP_ID}] if trip_found else []
    chain.select.return_value.eq.return_value.execute.return_value = response
    return chain


def _make_client(mock_sb: MagicMock) -> TestClient:
    app.dependency_overrides[itinerary_get_supabase] = lambda: mock_sb
    return TestClient(app)


def teardown_function() -> None:
    app.dependency_overrides.clear()


# ── Goal CRUD ─────────────────────────────────────────────────────────────────

def test_create_goal_returns_201() -> None:
    mock_sb = MagicMock()

    def table_side_effect(name: str) -> MagicMock:
        if name == "trips":
            return _make_trip_chain()
        chain = MagicMock()
        no_dup = MagicMock()
        no_dup.data = []
        chain.select.return_value.eq.return_value.eq.return_value.execute.return_value = no_dup
        inserted = MagicMock()
        inserted.data = [MOCK_GOAL]
        chain.insert.return_value.execute.return_value = inserted
        return chain

    mock_sb.table.side_effect = table_side_effect
    client = _make_client(mock_sb)
    response = client.post(
        f"/api/trips/{TRIP_ID}/goals",
        json={"goal_type": "preset", "label": "Cultural immersion"},
        headers={"X-API-Key": "test-key-12345"},
    )
    assert response.status_code == 201
    assert response.json()["label"] == "Cultural immersion"


def test_list_goals_returns_200() -> None:
    mock_sb = MagicMock()

    def table_side_effect(name: str) -> MagicMock:
        if name == "trips":
            return _make_trip_chain()
        chain = MagicMock()
        goals_response = MagicMock()
        goals_response.data = [MOCK_GOAL, MOCK_GOAL_2]
        chain.select.return_value.eq.return_value.execute.return_value = goals_response
        return chain

    mock_sb.table.side_effect = table_side_effect
    client = _make_client(mock_sb)
    response = client.get(f"/api/trips/{TRIP_ID}/goals")
    assert response.status_code == 200
    assert len(response.json()) == 2


def test_bulk_upsert_goals_returns_200() -> None:
    mock_sb = MagicMock()

    def table_side_effect(name: str) -> MagicMock:
        if name == "trips":
            return _make_trip_chain()
        chain = MagicMock()
        upsert_response = MagicMock()
        upsert_response.data = [MOCK_GOAL, MOCK_GOAL_2]
        chain.upsert.return_value.execute.return_value = upsert_response
        return chain

    mock_sb.table.side_effect = table_side_effect
    client = _make_client(mock_sb)
    response = client.put(
        f"/api/trips/{TRIP_ID}/goals",
        json={
            "goals": [
                {"goal_type": "preset", "label": "Cultural immersion"},
                {"goal_type": "custom", "label": "Visit family friends"},
            ]
        },
        headers={"X-API-Key": "test-key-12345"},
    )
    assert response.status_code == 200
    assert len(response.json()) == 2


def test_delete_goal_returns_204() -> None:
    mock_sb = MagicMock()

    def table_side_effect(name: str) -> MagicMock:
        if name == "trips":
            return _make_trip_chain()
        chain = MagicMock()
        found = MagicMock()
        found.data = [{"id": GOAL_ID}]
        chain.select.return_value.eq.return_value.eq.return_value.execute.return_value = found
        chain.delete.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock()
        return chain

    mock_sb.table.side_effect = table_side_effect
    client = _make_client(mock_sb)
    response = client.delete(
        f"/api/trips/{TRIP_ID}/goals/{GOAL_ID}",
        headers={"X-API-Key": "test-key-12345"},
    )
    assert response.status_code == 204


# ── Constraint CRUD ───────────────────────────────────────────────────────────

def test_create_constraint_returns_201() -> None:
    mock_sb = MagicMock()

    def table_side_effect(name: str) -> MagicMock:
        if name == "trips":
            return _make_trip_chain()
        chain = MagicMock()
        inserted = MagicMock()
        inserted.data = [MOCK_CONSTRAINT]
        chain.insert.return_value.execute.return_value = inserted
        return chain

    mock_sb.table.side_effect = table_side_effect
    client = _make_client(mock_sb)
    response = client.post(
        f"/api/trips/{TRIP_ID}/constraints",
        json={"constraint_type": "must_visit", "description": "Must visit the Eiffel Tower"},
        headers={"X-API-Key": "test-key-12345"},
    )
    assert response.status_code == 201
    assert response.json()["constraint_type"] == "must_visit"


def test_list_constraints_returns_200() -> None:
    mock_sb = MagicMock()

    def table_side_effect(name: str) -> MagicMock:
        if name == "trips":
            return _make_trip_chain()
        chain = MagicMock()
        result = MagicMock()
        result.data = [MOCK_CONSTRAINT]
        chain.select.return_value.eq.return_value.execute.return_value = result
        return chain

    mock_sb.table.side_effect = table_side_effect
    client = _make_client(mock_sb)
    response = client.get(f"/api/trips/{TRIP_ID}/constraints")
    assert response.status_code == 200
    assert len(response.json()) == 1


def test_delete_constraint_returns_204() -> None:
    mock_sb = MagicMock()

    def table_side_effect(name: str) -> MagicMock:
        if name == "trips":
            return _make_trip_chain()
        chain = MagicMock()
        found = MagicMock()
        found.data = [{"id": CONSTRAINT_ID}]
        chain.select.return_value.eq.return_value.eq.return_value.execute.return_value = found
        chain.delete.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock()
        return chain

    mock_sb.table.side_effect = table_side_effect
    client = _make_client(mock_sb)
    response = client.delete(
        f"/api/trips/{TRIP_ID}/constraints/{CONSTRAINT_ID}",
        headers={"X-API-Key": "test-key-12345"},
    )
    assert response.status_code == 204


# ── Edge cases ────────────────────────────────────────────────────────────────

def test_duplicate_goal_rejected() -> None:
    mock_sb = MagicMock()

    def table_side_effect(name: str) -> MagicMock:
        if name == "trips":
            return _make_trip_chain()
        chain = MagicMock()
        dup = MagicMock()
        dup.data = [MOCK_GOAL]
        chain.select.return_value.eq.return_value.eq.return_value.execute.return_value = dup
        return chain

    mock_sb.table.side_effect = table_side_effect
    client = _make_client(mock_sb)
    response = client.post(
        f"/api/trips/{TRIP_ID}/goals",
        json={"goal_type": "preset", "label": "Cultural immersion"},
        headers={"X-API-Key": "test-key-12345"},
    )
    assert response.status_code == 409


def test_invalid_constraint_type_returns_422() -> None:
    mock_sb = MagicMock()
    client = _make_client(mock_sb)
    response = client.post(
        f"/api/trips/{TRIP_ID}/constraints",
        json={"constraint_type": "invalid_type", "description": "test"},
        headers={"X-API-Key": "test-key-12345"},
    )
    assert response.status_code == 422


# ── Itinerary read ────────────────────────────────────────────────────────────

def test_get_itinerary_empty_structure() -> None:
    mock_sb = MagicMock()

    def table_side_effect(name: str) -> MagicMock:
        if name == "trips":
            return _make_trip_chain()
        chain = MagicMock()
        empty = MagicMock()
        empty.data = []
        chain.select.return_value.eq.return_value.execute.return_value = empty
        return chain

    mock_sb.table.side_effect = table_side_effect
    client = _make_client(mock_sb)
    response = client.get(f"/api/trips/{TRIP_ID}/itinerary")
    assert response.status_code == 200
    body = response.json()
    assert body["days"] == []
    assert body["goals"] == []
    assert body["constraints"] == []
