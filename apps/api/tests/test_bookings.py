from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from main import app, get_supabase

TRIP_ID = "550e8400-e29b-41d4-a716-446655440000"
NONEXISTENT_TRIP_ID = "00000000-0000-0000-0000-000000000000"

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
    # 4800 + 400 + 1200 = 6400
    client = _client_with_mock()
    summary = client.get(f"/trips/{TRIP_ID}/bookings").json()["summary"]
    assert summary["total_estimated"] == 6400.00


def test_summary_total_actual():
    # Only uuid-2 has actual_cost: 380.00
    client = _client_with_mock()
    summary = client.get(f"/trips/{TRIP_ID}/bookings").json()["summary"]
    assert summary["total_actual"] == 380.00


def test_summary_locked_in():
    # uuid-2 is booked: actual_cost=380.00
    client = _client_with_mock()
    summary = client.get(f"/trips/{TRIP_ID}/bookings").json()["summary"]
    assert summary["locked_in"] == 380.00


def test_summary_remaining():
    # total_estimated(6400) - locked_in(380) = 6020
    client = _client_with_mock()
    summary = client.get(f"/trips/{TRIP_ID}/bookings").json()["summary"]
    assert summary["remaining"] == 6020.00


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
