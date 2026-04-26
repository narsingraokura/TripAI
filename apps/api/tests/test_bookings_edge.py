"""
Adversarial and edge-case tests for:
  GET    /trips/{trip_id}/bookings
  PATCH  /trips/{trip_id}/bookings/{booking_id}
  POST   /trips/{trip_id}/bookings
  DELETE /trips/{trip_id}/bookings/{booking_id}

Supplement test_bookings.py with cases the developer did not cover.
"""
import os
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from main import BUDGET_CAP, app, get_supabase

TRIP_ID = "550e8400-e29b-41d4-a716-446655440000"
OTHER_TRIP_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
BOOKING_ID = "uuid-edge-1"
API_KEY = "test-key-12345"

MOCK_BOOKING = {
    "id": BOOKING_ID,
    "trip_id": TRIP_ID,
    "title": "Louvre Timed Entry",
    "subtitle": "Jun 25 9am",
    "category": "activities",
    "urgency": "soon",
    "status": "pending",
    "estimated_cost": 100.00,
    "actual_cost": None,
    "deadline": "Late April",
    "discount_code": None,
    "card_tip": "Venture X",
    "booked_at": None,
}

BOOKED_MOCK = {**MOCK_BOOKING, "status": "booked", "actual_cost": 95.00}


def teardown_function() -> None:
    app.dependency_overrides.clear()


def _patch_mock(trip_found: bool = True, booking_found: bool = True, returned: dict | None = None) -> MagicMock:
    returned = returned or MOCK_BOOKING
    mock = MagicMock()
    trip_resp = MagicMock()
    trip_resp.data = [{"id": TRIP_ID}] if trip_found else []
    select_resp = MagicMock()
    select_resp.data = [MOCK_BOOKING] if booking_found else []
    update_resp = MagicMock()
    update_resp.data = [returned]

    def table_side(name: str) -> MagicMock:
        chain = MagicMock()
        if name == "trips":
            chain.select.return_value.eq.return_value.execute.return_value = trip_resp
        else:
            chain.select.return_value.eq.return_value.eq.return_value.execute.return_value = select_resp
            chain.update.return_value.eq.return_value.eq.return_value.execute.return_value = update_resp
        return chain

    mock.table.side_effect = table_side
    return mock


def _post_mock(trip_found: bool = True) -> MagicMock:
    mock = MagicMock()
    trip_resp = MagicMock()
    trip_resp.data = [{"id": TRIP_ID}] if trip_found else []
    insert_resp = MagicMock()
    insert_resp.data = [MOCK_BOOKING]

    def table_side(name: str) -> MagicMock:
        chain = MagicMock()
        if name == "trips":
            chain.select.return_value.eq.return_value.execute.return_value = trip_resp
        else:
            chain.insert.return_value.execute.return_value = insert_resp
        return chain

    mock.table.side_effect = table_side
    return mock


def _delete_mock(trip_id: str = TRIP_ID, booking_found: bool = True) -> MagicMock:
    mock = MagicMock()
    trip_resp = MagicMock()
    trip_resp.data = [{"id": trip_id}]
    select_resp = MagicMock()
    select_resp.data = [MOCK_BOOKING] if booking_found else []
    delete_resp = MagicMock()
    delete_resp.data = []

    def table_side(name: str) -> MagicMock:
        chain = MagicMock()
        if name == "trips":
            chain.select.return_value.eq.return_value.execute.return_value = trip_resp
        else:
            chain.select.return_value.eq.return_value.eq.return_value.execute.return_value = select_resp
            chain.delete.return_value.eq.return_value.eq.return_value.execute.return_value = delete_resp
        return chain

    mock.table.side_effect = table_side
    return mock


# ── PATCH: negative costs must be rejected ────────────────────────────────────

def test_patch_negative_actual_cost_returns_422() -> None:
    """actual_cost must be >= 0; negative values must be rejected with 422."""
    mock_sb = _patch_mock()
    app.dependency_overrides[get_supabase] = lambda: mock_sb
    resp = TestClient(app).patch(
        f"/trips/{TRIP_ID}/bookings/{BOOKING_ID}",
        json={"actual_cost": -50.00},
        headers={"X-API-Key": API_KEY},
    )
    assert resp.status_code == 422


def test_patch_negative_estimated_cost_returns_422() -> None:
    """estimated_cost must be >= 0; negative values must be rejected with 422."""
    mock_sb = _patch_mock()
    app.dependency_overrides[get_supabase] = lambda: mock_sb
    resp = TestClient(app).patch(
        f"/trips/{TRIP_ID}/bookings/{BOOKING_ID}",
        json={"estimated_cost": -200.00},
        headers={"X-API-Key": API_KEY},
    )
    assert resp.status_code == 422


# ── PATCH: empty body (all-None) — idempotent ─────────────────────────────────

def test_patch_booking_with_all_none_body_returns_200_and_unchanged_booking() -> None:
    """Sending an all-None PATCH body results in exclude_none=True producing {}.
    The backend issues an empty Supabase update, which returns the existing row — 200."""
    mock_sb = _patch_mock(returned=MOCK_BOOKING)
    app.dependency_overrides[get_supabase] = lambda: mock_sb
    resp = TestClient(app).patch(
        f"/trips/{TRIP_ID}/bookings/{BOOKING_ID}",
        json={},
        headers={"X-API-Key": API_KEY},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["title"] == MOCK_BOOKING["title"]
    assert body["status"] == MOCK_BOOKING["status"]


# ── PATCH: wrong (non-empty) API key ─────────────────────────────────────────

def test_patch_booking_wrong_key_value_returns_403() -> None:
    """hmac.compare_digest must reject a wrong non-empty key, not just a missing one."""
    resp = TestClient(app).patch(
        f"/trips/{TRIP_ID}/bookings/{BOOKING_ID}",
        json={"status": "booked"},
        headers={"X-API-Key": "completely-wrong-key"},
    )
    assert resp.status_code == 403


# ── PATCH: invalid status value returns 422 ───────────────────────────────────

def test_patch_booking_invalid_status_returns_422() -> None:
    """status must be 'booked' or 'pending'; any other value must be rejected."""
    mock_sb = _patch_mock()
    app.dependency_overrides[get_supabase] = lambda: mock_sb
    resp = TestClient(app).patch(
        f"/trips/{TRIP_ID}/bookings/{BOOKING_ID}",
        json={"status": "confirmed"},
        headers={"X-API-Key": API_KEY},
    )
    assert resp.status_code == 422


# ── POST: missing estimated_cost returns 422 ──────────────────────────────────

def test_post_booking_missing_estimated_cost_returns_422() -> None:
    """estimated_cost is required (no default). Omitting it must return 422."""
    app.dependency_overrides[get_supabase] = lambda: _post_mock()
    resp = TestClient(app).post(
        f"/trips/{TRIP_ID}/bookings",
        json={
            "title": "Louvre tickets",
            "category": "activities",
            "urgency": "soon",
            # estimated_cost intentionally omitted
        },
        headers={"X-API-Key": API_KEY},
    )
    assert resp.status_code == 422


# ── POST: invalid urgency value returns 422 ───────────────────────────────────

def test_post_booking_invalid_urgency_returns_422() -> None:
    """urgency must be one of fire/now/soon/later; anything else must return 422."""
    app.dependency_overrides[get_supabase] = lambda: _post_mock()
    resp = TestClient(app).post(
        f"/trips/{TRIP_ID}/bookings",
        json={
            "title": "Louvre tickets",
            "category": "activities",
            "urgency": "asap",
            "estimated_cost": 100.00,
        },
        headers={"X-API-Key": API_KEY},
    )
    assert resp.status_code == 422


# ── DELETE: multi-tenancy isolation ───────────────────────────────────────────

def test_delete_booking_from_wrong_trip_returns_404() -> None:
    """A booking that belongs to TRIP_ID must not be deletable via OTHER_TRIP_ID.
    The .eq('trip_id', other_trip_id) filter on the booking query returns empty
    → 404, confirming trip isolation."""
    mock = MagicMock()
    # Both trips "exist"
    trip_resp = MagicMock()
    trip_resp.data = [{"id": OTHER_TRIP_ID}]
    # Booking lookup with (id=BOOKING_ID, trip_id=OTHER_TRIP_ID) returns nothing
    select_resp = MagicMock()
    select_resp.data = []

    def table_side(name: str) -> MagicMock:
        chain = MagicMock()
        if name == "trips":
            chain.select.return_value.eq.return_value.execute.return_value = trip_resp
        else:
            chain.select.return_value.eq.return_value.eq.return_value.execute.return_value = select_resp
        return chain

    mock.table.side_effect = table_side
    app.dependency_overrides[get_supabase] = lambda: mock

    resp = TestClient(app).delete(
        f"/trips/{OTHER_TRIP_ID}/bookings/{BOOKING_ID}",
        headers={"X-API-Key": API_KEY},
    )
    assert resp.status_code == 404


# ── Summary formula: locked_in uses actual_cost when set, else estimated_cost ─

def test_summary_locked_in_formula_uses_actual_cost_when_set() -> None:
    """Formula assertion: locked_in = actual_cost (not estimated) when actual_cost is set."""
    booked_bookings = [BOOKED_MOCK]  # status=booked, actual_cost=95.00, estimated=100.00
    mock = MagicMock()
    trip_resp = MagicMock()
    trip_resp.data = [{"id": TRIP_ID}]
    bookings_resp = MagicMock()
    bookings_resp.data = booked_bookings

    def table_side(name: str) -> MagicMock:
        chain = MagicMock()
        if name == "trips":
            chain.select.return_value.eq.return_value.execute.return_value = trip_resp
        else:
            chain.select.return_value.eq.return_value.execute.return_value = bookings_resp
        return chain

    mock.table.side_effect = table_side
    app.dependency_overrides[get_supabase] = lambda: mock

    resp = TestClient(app).get(f"/trips/{TRIP_ID}/bookings")
    assert resp.status_code == 200
    summary = resp.json()["summary"]

    # Formula assertion: actual_cost (95) is used, NOT estimated_cost (100)
    expected_locked_in = BOOKED_MOCK["actual_cost"]  # 95.00
    assert summary["locked_in"] == pytest.approx(expected_locked_in), (
        "locked_in must use actual_cost when present, not estimated_cost"
    )
    assert summary["locked_in"] != pytest.approx(BOOKED_MOCK["estimated_cost"]), (
        "locked_in must NOT fall back to estimated_cost when actual_cost is set"
    )
    # remaining formula
    assert summary["remaining"] == pytest.approx(BUDGET_CAP - summary["locked_in"])
