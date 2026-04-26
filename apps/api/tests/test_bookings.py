import pytest
from unittest.mock import MagicMock
from fastapi.testclient import TestClient
from main import BUDGET_CAP, app, get_supabase

TRIP_ID = "550e8400-e29b-41d4-a716-446655440000"
NONEXISTENT_TRIP_ID = "00000000-0000-0000-0000-000000000000"
BOOKING_ID = "uuid-1"  # fire/pending booking in MOCK_BOOKINGS_UNSORTED

# Ordered wrong intentionally — implementation must sort them
MOCK_BOOKINGS_UNSORTED = [
    {
        "id": "uuid-3",
        "trip_id": TRIP_ID,
        "title": "London — The Ned",
        "subtitle": "3 nights, Jun 19–22",
        "category": "hotels",
        "urgency": "soon",
        "status": "pending",
        "estimated_cost": 1200.00,
        "actual_cost": None,
        "deadline": "Feb 2026",
        "discount_code": "SC196337864",
        "card_tip": "Amex Gold via AmexTravel 2X MR",
        "booked_at": None,
    },
    {
        "id": "uuid-1",
        "trip_id": TRIP_ID,
        "title": "SFO → LHR Flights",
        "subtitle": "United Economy, 4 seats",
        "category": "flights",
        "urgency": "fire",
        "status": "pending",
        "estimated_cost": 4800.00,
        "actual_cost": None,
        "deadline": "Jan 15 — prices spike",
        "discount_code": None,
        "card_tip": "Amex Gold 3X MR",
        "booked_at": None,
    },
    {
        "id": "uuid-2",
        "trip_id": TRIP_ID,
        "title": "Titlis Mountain Day",
        "subtitle": "Gondola + rotair",
        "category": "activities",
        "urgency": "now",
        "status": "booked",
        "estimated_cost": 400.00,
        "actual_cost": 380.00,
        "deadline": "Mar 2026",
        "discount_code": None,
        "card_tip": "Venture X (CHF, no FX fee)",
        "booked_at": "2026-01-15T10:00:00+00:00",
    },
]


def _make_supabase_mock(trip_found: bool = True) -> MagicMock:
    """Build a Supabase client mock that chains .table().select().eq().execute()."""
    mock = MagicMock()

    trip_response = MagicMock()
    trip_response.data = [{"id": TRIP_ID}] if trip_found else []

    bookings_response = MagicMock()
    bookings_response.data = MOCK_BOOKINGS_UNSORTED if trip_found else []

    def table_side_effect(table_name: str):
        chain = MagicMock()
        if table_name == "trips":
            chain.select.return_value.eq.return_value.execute.return_value = trip_response
        else:
            chain.select.return_value.eq.return_value.execute.return_value = bookings_response
        return chain

    mock.table.side_effect = table_side_effect
    return mock


def _client_with_mock(trip_found: bool = True) -> TestClient:
    mock_supabase = _make_supabase_mock(trip_found)
    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    return TestClient(app)


def teardown_function():
    app.dependency_overrides.clear()


# ── Basic shape ──────────────────────────────────────────────────────────────

def test_get_bookings_returns_200():
    client = _client_with_mock()
    response = client.get(f"/trips/{TRIP_ID}/bookings")
    assert response.status_code == 200


def test_get_bookings_returns_bookings_and_summary_keys():
    client = _client_with_mock()
    body = client.get(f"/trips/{TRIP_ID}/bookings").json()
    assert "bookings" in body
    assert "summary" in body


def test_get_bookings_returns_correct_count():
    client = _client_with_mock()
    body = client.get(f"/trips/{TRIP_ID}/bookings").json()
    assert len(body["bookings"]) == 3


# ── Sorting ──────────────────────────────────────────────────────────────────

def test_bookings_sorted_fire_then_now_then_soon():
    client = _client_with_mock()
    bookings = client.get(f"/trips/{TRIP_ID}/bookings").json()["bookings"]
    urgencies = [b["urgency"] for b in bookings]
    assert urgencies == ["fire", "now", "soon"]


# ── Booking fields ────────────────────────────────────────────────────────────

def test_booking_has_required_fields():
    client = _client_with_mock()
    booking = client.get(f"/trips/{TRIP_ID}/bookings").json()["bookings"][0]
    required = {
        "id", "title", "subtitle", "category", "urgency", "status",
        "estimated_cost", "actual_cost", "deadline", "discount_code",
        "card_tip", "booked_at",
    }
    assert required.issubset(booking.keys())


# ── Summary fields ────────────────────────────────────────────────────────────

def test_summary_has_required_fields():
    client = _client_with_mock()
    summary = client.get(f"/trips/{TRIP_ID}/bookings").json()["summary"]
    required = {
        "total_estimated", "total_actual", "locked_in",
        "remaining", "booked_count", "total_count",
    }
    assert required.issubset(summary.keys())


def test_summary_total_estimated():
    client = _client_with_mock()
    summary = client.get(f"/trips/{TRIP_ID}/bookings").json()["summary"]
    expected = sum(b["estimated_cost"] for b in MOCK_BOOKINGS_UNSORTED)
    assert summary["total_estimated"] == pytest.approx(expected)


def test_summary_total_actual():
    client = _client_with_mock()
    summary = client.get(f"/trips/{TRIP_ID}/bookings").json()["summary"]
    expected = sum(b["actual_cost"] for b in MOCK_BOOKINGS_UNSORTED if b["actual_cost"] is not None)
    assert summary["total_actual"] == pytest.approx(expected)


def test_summary_locked_in():
    client = _client_with_mock()
    summary = client.get(f"/trips/{TRIP_ID}/bookings").json()["summary"]
    expected = sum(
        (b["actual_cost"] if b["actual_cost"] is not None else b["estimated_cost"])
        for b in MOCK_BOOKINGS_UNSORTED
        if b["status"] == "booked"
    )
    assert summary["locked_in"] == pytest.approx(expected)


def test_summary_remaining_uses_budget_cap_formula():
    """
    Regression test for the P1 budget formula bug.

    The original assertion was `remaining == 24620.00`, which passed
    even when the formula was wrong (total_estimated - locked_in)
    because the seeded data coincidentally produced a different scalar.
    This version asserts the RELATIONSHIP, not the scalar — so it fails
    under any wrong formula regardless of test data.

    See CLAUDE.md → "Numerical test principle".
    """
    client = _client_with_mock()
    summary = client.get(f"/trips/{TRIP_ID}/bookings").json()["summary"]

    # Assert the invariant: remaining is derived from BUDGET_CAP, not total_estimated.
    assert summary["remaining"] == pytest.approx(BUDGET_CAP - summary["locked_in"])

    # Negative check: remaining must NOT equal the wrong formula's output
    # (unless by coincidence total_estimated == BUDGET_CAP, which it doesn't here).
    wrong_formula = summary["total_estimated"] - summary["locked_in"]
    assert summary["remaining"] != pytest.approx(wrong_formula), (
        f"remaining ({summary['remaining']}) matches the WRONG formula "
        f"total_estimated - locked_in. Should be BUDGET_CAP - locked_in."
    )

def test_summary_booked_count():
    # Only uuid-2 has status=booked
    client = _client_with_mock()
    summary = client.get(f"/trips/{TRIP_ID}/bookings").json()["summary"]
    assert summary["booked_count"] == 1


def test_summary_total_count():
    client = _client_with_mock()
    summary = client.get(f"/trips/{TRIP_ID}/bookings").json()["summary"]
    assert summary["total_count"] == 3


# ── 404 ───────────────────────────────────────────────────────────────────────

def test_nonexistent_trip_returns_404():
    client = _client_with_mock(trip_found=False)
    response = client.get(f"/trips/{NONEXISTENT_TRIP_ID}/bookings")
    assert response.status_code == 404


def test_nonexistent_trip_returns_detail_message():
    client = _client_with_mock(trip_found=False)
    body = client.get(f"/trips/{NONEXISTENT_TRIP_ID}/bookings").json()
    assert "detail" in body


# ── PATCH /trips/{trip_id}/bookings/{booking_id} ──────────────────────────────

def _make_patch_supabase_mock(
    trip_found: bool = True,
    booking_found: bool = True,
    new_status: str = "booked",
) -> MagicMock:
    """Build a mock for the PATCH endpoint's three Supabase calls."""
    mock = MagicMock()

    trip_response = MagicMock()
    trip_response.data = [{"id": TRIP_ID}] if trip_found else []

    original_booking = MOCK_BOOKINGS_UNSORTED[1]  # uuid-1, fire, pending

    select_response = MagicMock()
    select_response.data = [original_booking] if booking_found else []

    update_response = MagicMock()
    update_response.data = [{**original_booking, "status": new_status}]

    def table_side_effect(table_name: str):
        chain = MagicMock()
        if table_name == "trips":
            chain.select.return_value.eq.return_value.execute.return_value = trip_response
        else:
            # select("*").eq(id).eq(trip_id).execute()
            chain.select.return_value.eq.return_value.eq.return_value.execute.return_value = select_response
            # update({status}).eq(id).eq(trip_id).execute()
            chain.update.return_value.eq.return_value.eq.return_value.execute.return_value = update_response
        return chain

    mock.table.side_effect = table_side_effect
    return mock


def _patch_client(
    trip_found: bool = True,
    booking_found: bool = True,
    new_status: str = "booked",
) -> TestClient:
    mock_supabase = _make_patch_supabase_mock(trip_found, booking_found, new_status)
    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    return TestClient(app)


def test_patch_booking_returns_200():
    client = _patch_client()
    response = client.patch(
        f"/trips/{TRIP_ID}/bookings/{BOOKING_ID}",
        json={"status": "booked"},
        headers={"X-API-Key": "test-key-12345"},
    )
    assert response.status_code == 200


def test_patch_booking_returns_updated_status_booked():
    client = _patch_client(new_status="booked")
    body = client.patch(
        f"/trips/{TRIP_ID}/bookings/{BOOKING_ID}",
        json={"status": "booked"},
        headers={"X-API-Key": "test-key-12345"},
    ).json()
    assert body["status"] == "booked"


def test_patch_booking_returns_updated_status_pending():
    client = _patch_client(new_status="pending")
    body = client.patch(
        f"/trips/{TRIP_ID}/bookings/{BOOKING_ID}",
        json={"status": "pending"},
        headers={"X-API-Key": "test-key-12345"},
    ).json()
    assert body["status"] == "pending"


def test_patch_booking_nonexistent_trip_returns_404():
    client = _patch_client(trip_found=False)
    response = client.patch(
        f"/trips/{NONEXISTENT_TRIP_ID}/bookings/{BOOKING_ID}",
        json={"status": "booked"},
        headers={"X-API-Key": "test-key-12345"},
    )
    assert response.status_code == 404


def test_patch_booking_nonexistent_booking_returns_404():
    client = _patch_client(booking_found=False)
    response = client.patch(
        f"/trips/{TRIP_ID}/bookings/nonexistent-id",
        json={"status": "booked"},
        headers={"X-API-Key": "test-key-12345"},
    )
    assert response.status_code == 404


# ── PATCH extended fields ─────────────────────────────────────────────────────

def _make_extended_patch_mock(update_fields: dict) -> MagicMock:
    """Build a PATCH mock that returns original booking merged with update_fields."""
    mock = MagicMock()

    trip_response = MagicMock()
    trip_response.data = [{"id": TRIP_ID}]

    original = MOCK_BOOKINGS_UNSORTED[1]  # uuid-1, fire, pending

    select_response = MagicMock()
    select_response.data = [original]

    update_response = MagicMock()
    update_response.data = [{**original, **update_fields}]

    def table_side_effect(table_name: str):
        chain = MagicMock()
        if table_name == "trips":
            chain.select.return_value.eq.return_value.execute.return_value = trip_response
        else:
            chain.select.return_value.eq.return_value.eq.return_value.execute.return_value = select_response
            chain.update.return_value.eq.return_value.eq.return_value.execute.return_value = update_response
        return chain

    mock.table.side_effect = table_side_effect
    return mock


def test_patch_booking_actual_cost():
    mock_sb = _make_extended_patch_mock({"actual_cost": 4600.00})
    app.dependency_overrides[get_supabase] = lambda: mock_sb
    client = TestClient(app)
    body = client.patch(
        f"/trips/{TRIP_ID}/bookings/{BOOKING_ID}",
        json={"actual_cost": 4600.00},
        headers={"X-API-Key": "test-key-12345"},
    ).json()
    assert body["actual_cost"] == 4600.00


def test_patch_booking_estimated_cost():
    mock_sb = _make_extended_patch_mock({"estimated_cost": 5000.00})
    app.dependency_overrides[get_supabase] = lambda: mock_sb
    client = TestClient(app)
    body = client.patch(
        f"/trips/{TRIP_ID}/bookings/{BOOKING_ID}",
        json={"estimated_cost": 5000.00},
        headers={"X-API-Key": "test-key-12345"},
    ).json()
    assert body["estimated_cost"] == 5000.00


def test_patch_booking_title():
    mock_sb = _make_extended_patch_mock({"title": "Updated Title"})
    app.dependency_overrides[get_supabase] = lambda: mock_sb
    client = TestClient(app)
    body = client.patch(
        f"/trips/{TRIP_ID}/bookings/{BOOKING_ID}",
        json={"title": "Updated Title"},
        headers={"X-API-Key": "test-key-12345"},
    ).json()
    assert body["title"] == "Updated Title"


def test_patch_booking_invalid_field_type_returns_422():
    client = _patch_client()
    response = client.patch(
        f"/trips/{TRIP_ID}/bookings/{BOOKING_ID}",
        json={"actual_cost": "not-a-number"},
        headers={"X-API-Key": "test-key-12345"},
    )
    assert response.status_code == 422


# ── POST /trips/{trip_id}/bookings ────────────────────────────────────────────

NEW_BOOKING = {
    "id": "uuid-new",
    "trip_id": TRIP_ID,
    "title": "Milan Duomo rooftop",
    "subtitle": "Jul 3 morning",
    "category": "activities",
    "urgency": "soon",
    "status": "pending",
    "estimated_cost": 80.00,
    "actual_cost": None,
    "deadline": "May 2026",
    "discount_code": None,
    "card_tip": "Venture X",
    "booked_at": None,
}

POST_BODY = {
    "title": "Milan Duomo rooftop",
    "subtitle": "Jul 3 morning",
    "category": "activities",
    "urgency": "soon",
    "status": "pending",
    "estimated_cost": 80.00,
    "deadline": "May 2026",
    "card_tip": "Venture X",
}


def _make_post_supabase_mock(trip_found: bool = True) -> MagicMock:
    mock = MagicMock()

    trip_response = MagicMock()
    trip_response.data = [{"id": TRIP_ID}] if trip_found else []

    insert_response = MagicMock()
    insert_response.data = [NEW_BOOKING] if trip_found else []

    def table_side_effect(table_name: str):
        chain = MagicMock()
        if table_name == "trips":
            chain.select.return_value.eq.return_value.execute.return_value = trip_response
        else:
            chain.insert.return_value.execute.return_value = insert_response
        return chain

    mock.table.side_effect = table_side_effect
    return mock


def test_post_booking_returns_201():
    app.dependency_overrides[get_supabase] = lambda: _make_post_supabase_mock()
    client = TestClient(app)
    response = client.post(
        f"/trips/{TRIP_ID}/bookings",
        json=POST_BODY,
        headers={"X-API-Key": "test-key-12345"},
    )
    assert response.status_code == 201


def test_post_booking_returns_id():
    app.dependency_overrides[get_supabase] = lambda: _make_post_supabase_mock()
    client = TestClient(app)
    body = client.post(
        f"/trips/{TRIP_ID}/bookings",
        json=POST_BODY,
        headers={"X-API-Key": "test-key-12345"},
    ).json()
    assert "id" in body


def test_post_booking_title_in_response():
    app.dependency_overrides[get_supabase] = lambda: _make_post_supabase_mock()
    client = TestClient(app)
    body = client.post(
        f"/trips/{TRIP_ID}/bookings",
        json=POST_BODY,
        headers={"X-API-Key": "test-key-12345"},
    ).json()
    assert body["title"] == POST_BODY["title"]


def test_post_booking_missing_title_returns_422():
    app.dependency_overrides[get_supabase] = lambda: _make_post_supabase_mock()
    client = TestClient(app)
    body_no_title = {k: v for k, v in POST_BODY.items() if k != "title"}
    response = client.post(
        f"/trips/{TRIP_ID}/bookings",
        json=body_no_title,
        headers={"X-API-Key": "test-key-12345"},
    )
    assert response.status_code == 422


def test_post_booking_invalid_category_returns_422():
    app.dependency_overrides[get_supabase] = lambda: _make_post_supabase_mock()
    client = TestClient(app)
    body_bad_cat = {**POST_BODY, "category": "invalid_category"}
    response = client.post(
        f"/trips/{TRIP_ID}/bookings",
        json=body_bad_cat,
        headers={"X-API-Key": "test-key-12345"},
    )
    assert response.status_code == 422


def test_post_booking_nonexistent_trip_returns_404():
    app.dependency_overrides[get_supabase] = lambda: _make_post_supabase_mock(trip_found=False)
    client = TestClient(app)
    response = client.post(
        f"/trips/{NONEXISTENT_TRIP_ID}/bookings",
        json=POST_BODY,
        headers={"X-API-Key": "test-key-12345"},
    )
    assert response.status_code == 404


# ── DELETE /trips/{trip_id}/bookings/{booking_id} ─────────────────────────────

DELETE_BOOKING_ID = "uuid-3"  # matches MOCK_BOOKINGS_UNSORTED[0]


def _make_delete_supabase_mock(
    trip_found: bool = True,
    booking_found: bool = True,
) -> MagicMock:
    mock = MagicMock()

    trip_response = MagicMock()
    trip_response.data = [{"id": TRIP_ID}] if trip_found else []

    booking_to_delete = MOCK_BOOKINGS_UNSORTED[0]  # uuid-3

    select_response = MagicMock()
    select_response.data = [booking_to_delete] if booking_found else []

    delete_response = MagicMock()
    delete_response.data = []

    def table_side_effect(table_name: str):
        chain = MagicMock()
        if table_name == "trips":
            chain.select.return_value.eq.return_value.execute.return_value = trip_response
        else:
            chain.select.return_value.eq.return_value.eq.return_value.execute.return_value = select_response
            chain.delete.return_value.eq.return_value.eq.return_value.execute.return_value = delete_response
        return chain

    mock.table.side_effect = table_side_effect
    return mock


def test_delete_booking_returns_204():
    app.dependency_overrides[get_supabase] = lambda: _make_delete_supabase_mock()
    client = TestClient(app)
    response = client.delete(
        f"/trips/{TRIP_ID}/bookings/{DELETE_BOOKING_ID}",
        headers={"X-API-Key": "test-key-12345"},
    )
    assert response.status_code == 204


def test_delete_booking_nonexistent_returns_404():
    app.dependency_overrides[get_supabase] = lambda: _make_delete_supabase_mock(booking_found=False)
    client = TestClient(app)
    response = client.delete(
        f"/trips/{TRIP_ID}/bookings/nonexistent-id",
        headers={"X-API-Key": "test-key-12345"},
    )
    assert response.status_code == 404


def test_delete_booking_nonexistent_trip_returns_404():
    app.dependency_overrides[get_supabase] = lambda: _make_delete_supabase_mock(trip_found=False)
    client = TestClient(app)
    response = client.delete(
        f"/trips/{NONEXISTENT_TRIP_ID}/bookings/{DELETE_BOOKING_ID}",
        headers={"X-API-Key": "test-key-12345"},
    )
    assert response.status_code == 404
