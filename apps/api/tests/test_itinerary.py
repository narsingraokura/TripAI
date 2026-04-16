from unittest.mock import MagicMock

from fastapi.testclient import TestClient

from main import app, get_supabase

TRIP_ID = "550e8400-e29b-41d4-a716-446655440000"
NONEXISTENT_TRIP_ID = "00000000-0000-0000-0000-000000000000"
DATE_JUN20 = "2026-06-20"
DATE_JUN22 = "2026-06-22"
MISSING_DATE = "2026-12-31"

# Out of order intentionally — implementation must sort by date
MOCK_DAYS_UNSORTED = [
    {
        "id": "day-uuid-2",
        "trip_id": TRIP_ID,
        "date": DATE_JUN22,
        "city": "London",
        "country": "UK",
        "title": "Westminster & Museums",
        "plan": "Big Ben, Natural History Museum, Westminster Abbey",
        "intensity": "busy",
        "is_special": False,
        "special_label": None,
    },
    {
        "id": "day-uuid-1",
        "trip_id": TRIP_ID,
        "date": DATE_JUN20,
        "city": "London",
        "country": "UK",
        "title": "Arrive London",
        "plan": "Land at LHR, check in, jet lag buffer",
        "intensity": "light",
        "is_special": False,
        "special_label": None,
    },
]


# ── Mock helpers ──────────────────────────────────────────────────────────────

def _make_list_mock(trip_found: bool = True) -> MagicMock:
    mock = MagicMock()
    trip_response = MagicMock()
    trip_response.data = [{"id": TRIP_ID}] if trip_found else []
    days_response = MagicMock()
    days_response.data = MOCK_DAYS_UNSORTED if trip_found else []

    def table_side_effect(table_name: str) -> MagicMock:
        chain = MagicMock()
        if table_name == "trips":
            chain.select.return_value.eq.return_value.execute.return_value = trip_response
        else:
            # .select("*").eq("trip_id", trip_id).execute()
            chain.select.return_value.eq.return_value.execute.return_value = days_response
        return chain

    mock.table.side_effect = table_side_effect
    return mock


def _make_single_day_mock(trip_found: bool = True, day_found: bool = True) -> MagicMock:
    mock = MagicMock()
    trip_response = MagicMock()
    trip_response.data = [{"id": TRIP_ID}] if trip_found else []
    day_response = MagicMock()
    day_response.data = [MOCK_DAYS_UNSORTED[1]] if day_found else []  # Jun 20

    def table_side_effect(table_name: str) -> MagicMock:
        chain = MagicMock()
        if table_name == "trips":
            chain.select.return_value.eq.return_value.execute.return_value = trip_response
        else:
            # .select("*").eq("date", date).eq("trip_id", trip_id).execute()
            chain.select.return_value.eq.return_value.eq.return_value.execute.return_value = day_response
        return chain

    mock.table.side_effect = table_side_effect
    return mock


def _make_patch_mock(
    trip_found: bool = True,
    day_found: bool = True,
    updated_fields: dict | None = None,
) -> MagicMock:
    mock = MagicMock()
    trip_response = MagicMock()
    trip_response.data = [{"id": TRIP_ID}] if trip_found else []

    original_day = MOCK_DAYS_UNSORTED[1]  # Jun 20, light intensity
    select_response = MagicMock()
    select_response.data = [original_day] if day_found else []

    update_response = MagicMock()
    update_response.data = [{**original_day, **(updated_fields or {})}]

    def table_side_effect(table_name: str) -> MagicMock:
        chain = MagicMock()
        if table_name == "trips":
            chain.select.return_value.eq.return_value.execute.return_value = trip_response
        else:
            # SELECT: .select("*").eq("date", date).eq("trip_id", trip_id).execute()
            chain.select.return_value.eq.return_value.eq.return_value.execute.return_value = select_response
            # UPDATE: .update({...}).eq("date", date).eq("trip_id", trip_id).execute()
            chain.update.return_value.eq.return_value.eq.return_value.execute.return_value = update_response
        return chain

    mock.table.side_effect = table_side_effect
    return mock


def _list_client(trip_found: bool = True) -> TestClient:
    app.dependency_overrides[get_supabase] = lambda: _make_list_mock(trip_found)
    return TestClient(app)


def _single_client(trip_found: bool = True, day_found: bool = True) -> TestClient:
    app.dependency_overrides[get_supabase] = lambda: _make_single_day_mock(trip_found, day_found)
    return TestClient(app)


def _patch_client(
    trip_found: bool = True,
    day_found: bool = True,
    updated_fields: dict | None = None,
) -> TestClient:
    app.dependency_overrides[get_supabase] = lambda: _make_patch_mock(trip_found, day_found, updated_fields)
    return TestClient(app)


def teardown_function() -> None:
    app.dependency_overrides.clear()


# ── GET /trips/{trip_id}/itinerary ────────────────────────────────────────────

def test_get_itinerary_returns_200() -> None:
    client = _list_client()
    response = client.get(f"/trips/{TRIP_ID}/itinerary")
    assert response.status_code == 200


def test_get_itinerary_returns_days_key() -> None:
    client = _list_client()
    body = client.get(f"/trips/{TRIP_ID}/itinerary").json()
    assert "days" in body


def test_get_itinerary_returns_correct_count() -> None:
    client = _list_client()
    body = client.get(f"/trips/{TRIP_ID}/itinerary").json()
    assert len(body["days"]) == 2


def test_get_itinerary_sorted_by_date() -> None:
    client = _list_client()
    days = client.get(f"/trips/{TRIP_ID}/itinerary").json()["days"]
    dates = [d["date"] for d in days]
    assert dates == sorted(dates)


def test_itinerary_day_has_required_fields() -> None:
    client = _list_client()
    day = client.get(f"/trips/{TRIP_ID}/itinerary").json()["days"][0]
    required = {
        "id", "trip_id", "date", "city", "country",
        "title", "plan", "intensity", "is_special", "special_label",
    }
    assert required.issubset(day.keys())


def test_get_itinerary_nonexistent_trip_returns_404() -> None:
    client = _list_client(trip_found=False)
    response = client.get(f"/trips/{NONEXISTENT_TRIP_ID}/itinerary")
    assert response.status_code == 404


# ── GET /trips/{trip_id}/itinerary/{date} ─────────────────────────────────────

def test_get_single_day_returns_200() -> None:
    client = _single_client()
    response = client.get(f"/trips/{TRIP_ID}/itinerary/{DATE_JUN20}")
    assert response.status_code == 200


def test_get_single_day_returns_correct_city() -> None:
    client = _single_client()
    body = client.get(f"/trips/{TRIP_ID}/itinerary/{DATE_JUN20}").json()
    assert body["city"] == "London"


def test_get_single_day_nonexistent_trip_returns_404() -> None:
    client = _single_client(trip_found=False)
    response = client.get(f"/trips/{NONEXISTENT_TRIP_ID}/itinerary/{DATE_JUN20}")
    assert response.status_code == 404


def test_get_single_day_missing_date_returns_404() -> None:
    client = _single_client(day_found=False)
    response = client.get(f"/trips/{TRIP_ID}/itinerary/{MISSING_DATE}")
    assert response.status_code == 404


# ── PATCH /trips/{trip_id}/itinerary/{date} ───────────────────────────────────

def test_patch_itinerary_returns_200() -> None:
    client = _patch_client(updated_fields={"title": "Updated Title"})
    response = client.patch(
        f"/trips/{TRIP_ID}/itinerary/{DATE_JUN20}",
        json={"title": "Updated Title"},
    )
    assert response.status_code == 200


def test_patch_itinerary_updates_title() -> None:
    client = _patch_client(updated_fields={"title": "New Title"})
    body = client.patch(
        f"/trips/{TRIP_ID}/itinerary/{DATE_JUN20}",
        json={"title": "New Title"},
    ).json()
    assert body["title"] == "New Title"


def test_patch_itinerary_updates_plan() -> None:
    new_plan = "Visit Westminster Bridge and the Tower of London"
    client = _patch_client(updated_fields={"plan": new_plan})
    body = client.patch(
        f"/trips/{TRIP_ID}/itinerary/{DATE_JUN20}",
        json={"plan": new_plan},
    ).json()
    assert body["plan"] == new_plan


def test_patch_itinerary_updates_intensity() -> None:
    client = _patch_client(updated_fields={"intensity": "moderate"})
    body = client.patch(
        f"/trips/{TRIP_ID}/itinerary/{DATE_JUN20}",
        json={"intensity": "moderate"},
    ).json()
    assert body["intensity"] == "moderate"


def test_patch_itinerary_nonexistent_trip_returns_404() -> None:
    client = _patch_client(trip_found=False)
    response = client.patch(
        f"/trips/{NONEXISTENT_TRIP_ID}/itinerary/{DATE_JUN20}",
        json={"title": "Updated"},
    )
    assert response.status_code == 404


def test_patch_itinerary_missing_date_returns_404() -> None:
    client = _patch_client(day_found=False)
    response = client.patch(
        f"/trips/{TRIP_ID}/itinerary/{MISSING_DATE}",
        json={"title": "Updated"},
    )
    assert response.status_code == 404


def test_patch_itinerary_invalid_intensity_returns_422() -> None:
    client = _patch_client()
    response = client.patch(
        f"/trips/{TRIP_ID}/itinerary/{DATE_JUN20}",
        json={"intensity": "extreme"},
    )
    assert response.status_code == 422
