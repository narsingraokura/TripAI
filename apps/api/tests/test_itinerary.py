import json
from unittest.mock import MagicMock

from fastapi.testclient import TestClient

from main import app, get_anthropic, get_supabase

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
        headers={"X-API-Key": "test-key-12345"},
    )
    assert response.status_code == 200


def test_patch_itinerary_updates_title() -> None:
    client = _patch_client(updated_fields={"title": "New Title"})
    body = client.patch(
        f"/trips/{TRIP_ID}/itinerary/{DATE_JUN20}",
        json={"title": "New Title"},
        headers={"X-API-Key": "test-key-12345"},
    ).json()
    assert body["title"] == "New Title"


def test_patch_itinerary_updates_plan() -> None:
    new_plan = "Visit Westminster Bridge and the Tower of London"
    client = _patch_client(updated_fields={"plan": new_plan})
    body = client.patch(
        f"/trips/{TRIP_ID}/itinerary/{DATE_JUN20}",
        json={"plan": new_plan},
        headers={"X-API-Key": "test-key-12345"},
    ).json()
    assert body["plan"] == new_plan


def test_patch_itinerary_updates_intensity() -> None:
    client = _patch_client(updated_fields={"intensity": "moderate"})
    body = client.patch(
        f"/trips/{TRIP_ID}/itinerary/{DATE_JUN20}",
        json={"intensity": "moderate"},
        headers={"X-API-Key": "test-key-12345"},
    ).json()
    assert body["intensity"] == "moderate"


def test_patch_itinerary_nonexistent_trip_returns_404() -> None:
    client = _patch_client(trip_found=False)
    response = client.patch(
        f"/trips/{NONEXISTENT_TRIP_ID}/itinerary/{DATE_JUN20}",
        json={"title": "Updated"},
        headers={"X-API-Key": "test-key-12345"},
    )
    assert response.status_code == 404


def test_patch_itinerary_missing_date_returns_404() -> None:
    client = _patch_client(day_found=False)
    response = client.patch(
        f"/trips/{TRIP_ID}/itinerary/{MISSING_DATE}",
        json={"title": "Updated"},
        headers={"X-API-Key": "test-key-12345"},
    )
    assert response.status_code == 404


def test_patch_itinerary_invalid_intensity_returns_422() -> None:
    client = _patch_client()
    response = client.patch(
        f"/trips/{TRIP_ID}/itinerary/{DATE_JUN20}",
        json={"intensity": "extreme"},
        headers={"X-API-Key": "test-key-12345"},
    )
    assert response.status_code == 422


# ── POST /trips/{trip_id}/itinerary/{date}/suggest ────────────────────────────

DATE_TITLIS = "2026-06-29"

MOCK_TITLIS_DAY = {
    "id": "day-uuid-titlis",
    "trip_id": TRIP_ID,
    "date": DATE_TITLIS,
    "city": "Interlaken",
    "country": "CH",
    "title": "Titlis Mountain Day",
    "plan": "Full day excursion to Mount Titlis via Engelberg. Take the Rotair (world's first revolving cable car). Snow activities at the top. Glacier walk. Return by evening.",
    "intensity": "busy",
    "is_special": False,
    "special_label": None,
}

MOCK_BOOKINGS_FOR_BUDGET = [
    {
        "id": "b1",
        "trip_id": TRIP_ID,
        "title": "Flights SFO→LHR",
        "subtitle": "4 seats",
        "category": "flights",
        "urgency": "fire",
        "status": "booked",
        "estimated_cost": 4800.00,
        "actual_cost": 4800.00,
        "deadline": "This week",
        "discount_code": None,
        "card_tip": "Amex Gold 3X MR",
        "booked_at": "2026-01-10T00:00:00+00:00",
    },
    {
        "id": "b2",
        "trip_id": TRIP_ID,
        "title": "Titlis Mountain Day",
        "subtitle": "Gondola + Rotair",
        "category": "activities",
        "urgency": "now",
        "status": "pending",
        "estimated_cost": 360.00,
        "actual_cost": None,
        "deadline": "Mar 2026",
        "discount_code": None,
        "card_tip": "Venture X (CHF)",
        "booked_at": None,
    },
]

# one cheaper (−220), one similar-cost (−30), one pricier (+180)
VALID_SUGGESTIONS = [
    {
        "title": "Harder Kulm Viewpoint",
        "description": "Take the funicular up to Harder Kulm for panoramic views over Interlaken and the Eiger.",
        "why_fits": "Kid-friendly, half-day activity, easy funicular ride with no altitude sickness concerns.",
        "cost_delta": -220,
        "intensity": "light",
        "booking_required": False,
    },
    {
        "title": "Lake Brienz Boat Tour",
        "description": "Cruise the turquoise Lake Brienz to Giessbach Falls and explore the lakeside village.",
        "why_fits": "Relaxing boat ride kids love, no strenuous hiking, stunning alpine scenery.",
        "cost_delta": -30,
        "intensity": "light",
        "booking_required": False,
    },
    {
        "title": "Jungfraujoch Top of Europe",
        "description": "Journey to the highest railway station in Europe at 3,454m for glacier views.",
        "why_fits": "Iconic Swiss landmark with indoor glacier cave — memorable and manageable for kids.",
        "cost_delta": 180,
        "intensity": "busy",
        "booking_required": True,
    },
]


def _make_suggest_supabase_mock(trip_found: bool = True, day_found: bool = True) -> MagicMock:
    mock = MagicMock()

    trip_response = MagicMock()
    trip_response.data = [{"id": TRIP_ID}] if trip_found else []

    day_response = MagicMock()
    day_response.data = [MOCK_TITLIS_DAY] if day_found else []

    bookings_response = MagicMock()
    bookings_response.data = MOCK_BOOKINGS_FOR_BUDGET if trip_found else []

    def table_side_effect(table_name: str) -> MagicMock:
        chain = MagicMock()
        if table_name == "trips":
            chain.select.return_value.eq.return_value.execute.return_value = trip_response
        elif table_name == "itinerary_days":
            # .select("*").eq("date", date).eq("trip_id", trip_id).execute()
            chain.select.return_value.eq.return_value.eq.return_value.execute.return_value = day_response
        else:  # bookings
            chain.select.return_value.eq.return_value.execute.return_value = bookings_response
        return chain

    mock.table.side_effect = table_side_effect
    return mock


def _make_claude_mock(suggestions: list = VALID_SUGGESTIONS) -> MagicMock:
    mock_client = MagicMock()
    mock_content = MagicMock()
    mock_content.text = json.dumps(suggestions)
    mock_client.messages.create.return_value.content = [mock_content]
    return mock_client


def _suggest_client(
    trip_found: bool = True,
    day_found: bool = True,
    suggestions: list = VALID_SUGGESTIONS,
) -> TestClient:
    app.dependency_overrides[get_supabase] = lambda: _make_suggest_supabase_mock(trip_found, day_found)
    app.dependency_overrides[get_anthropic] = lambda: _make_claude_mock(suggestions)
    return TestClient(app)


# Basic shape

def test_suggest_returns_200() -> None:
    client = _suggest_client()
    response = client.post(f"/trips/{TRIP_ID}/itinerary/{DATE_TITLIS}/suggest", headers={"X-API-Key": "test-key-12345"})
    assert response.status_code == 200


def test_suggest_response_has_date_city_suggestions_keys() -> None:
    client = _suggest_client()
    body = client.post(f"/trips/{TRIP_ID}/itinerary/{DATE_TITLIS}/suggest", headers={"X-API-Key": "test-key-12345"}).json()
    assert "date" in body
    assert "city" in body
    assert "suggestions" in body


def test_suggest_response_date_and_city_match_day() -> None:
    client = _suggest_client()
    body = client.post(f"/trips/{TRIP_ID}/itinerary/{DATE_TITLIS}/suggest", headers={"X-API-Key": "test-key-12345"}).json()
    assert body["date"] == DATE_TITLIS
    assert body["city"] == "Interlaken"


def test_suggest_returns_exactly_3_suggestions() -> None:
    client = _suggest_client()
    suggestions = client.post(f"/trips/{TRIP_ID}/itinerary/{DATE_TITLIS}/suggest", headers={"X-API-Key": "test-key-12345"}).json()["suggestions"]
    assert len(suggestions) == 3


# Suggestion shape

def test_each_suggestion_has_all_6_fields() -> None:
    client = _suggest_client()
    suggestions = client.post(f"/trips/{TRIP_ID}/itinerary/{DATE_TITLIS}/suggest", headers={"X-API-Key": "test-key-12345"}).json()["suggestions"]
    required = {"title", "description", "why_fits", "cost_delta", "intensity", "booking_required"}
    for s in suggestions:
        assert required.issubset(s.keys())


def test_suggestion_intensity_values_are_valid() -> None:
    client = _suggest_client()
    suggestions = client.post(f"/trips/{TRIP_ID}/itinerary/{DATE_TITLIS}/suggest", headers={"X-API-Key": "test-key-12345"}).json()["suggestions"]
    valid = {"light", "moderate", "busy"}
    for s in suggestions:
        assert s["intensity"] in valid


def test_suggestion_cost_delta_is_integer() -> None:
    client = _suggest_client()
    suggestions = client.post(f"/trips/{TRIP_ID}/itinerary/{DATE_TITLIS}/suggest", headers={"X-API-Key": "test-key-12345"}).json()["suggestions"]
    for s in suggestions:
        assert isinstance(s["cost_delta"], int)


def test_suggestion_booking_required_is_boolean() -> None:
    client = _suggest_client()
    suggestions = client.post(f"/trips/{TRIP_ID}/itinerary/{DATE_TITLIS}/suggest", headers={"X-API-Key": "test-key-12345"}).json()["suggestions"]
    for s in suggestions:
        assert isinstance(s["booking_required"], bool)


# Eval: Jun 29 Titlis day must include cheaper + similar-cost alternatives

def test_titlis_suggestions_include_at_least_one_cheaper_option() -> None:
    client = _suggest_client()
    suggestions = client.post(f"/trips/{TRIP_ID}/itinerary/{DATE_TITLIS}/suggest", headers={"X-API-Key": "test-key-12345"}).json()["suggestions"]
    cost_deltas = [s["cost_delta"] for s in suggestions]
    assert any(d < 0 for d in cost_deltas), f"Expected cheaper option (negative delta), got: {cost_deltas}"


def test_titlis_suggestions_include_at_least_one_similar_cost_option() -> None:
    client = _suggest_client()
    suggestions = client.post(f"/trips/{TRIP_ID}/itinerary/{DATE_TITLIS}/suggest", headers={"X-API-Key": "test-key-12345"}).json()["suggestions"]
    cost_deltas = [s["cost_delta"] for s in suggestions]
    assert any(abs(d) <= 50 for d in cost_deltas), f"Expected similar-cost option (delta ±50), got: {cost_deltas}"


# Claude receives correct context

def test_claude_called_with_city_in_user_message() -> None:
    mock_supabase = _make_suggest_supabase_mock()
    mock_claude = _make_claude_mock()
    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    app.dependency_overrides[get_anthropic] = lambda: mock_claude
    client = TestClient(app)
    client.post(f"/trips/{TRIP_ID}/itinerary/{DATE_TITLIS}/suggest", headers={"X-API-Key": "test-key-12345"})
    user_content = mock_claude.messages.create.call_args.kwargs["messages"][0]["content"]
    assert "Interlaken" in user_content


def test_claude_called_with_budget_in_user_message() -> None:
    mock_supabase = _make_suggest_supabase_mock()
    mock_claude = _make_claude_mock()
    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    app.dependency_overrides[get_anthropic] = lambda: mock_claude
    client = TestClient(app)
    client.post(f"/trips/{TRIP_ID}/itinerary/{DATE_TITLIS}/suggest", headers={"X-API-Key": "test-key-12345"})
    user_content = mock_claude.messages.create.call_args.kwargs["messages"][0]["content"]
    assert "budget" in user_content.lower() or "remaining" in user_content.lower()


def test_claude_called_with_temperature_07() -> None:
    mock_supabase = _make_suggest_supabase_mock()
    mock_claude = _make_claude_mock()
    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    app.dependency_overrides[get_anthropic] = lambda: mock_claude
    client = TestClient(app)
    client.post(f"/trips/{TRIP_ID}/itinerary/{DATE_TITLIS}/suggest", headers={"X-API-Key": "test-key-12345"})
    assert mock_claude.messages.create.call_args.kwargs["temperature"] == 0.7


# 404 cases

def test_suggest_trip_not_found_returns_404() -> None:
    client = _suggest_client(trip_found=False)
    response = client.post(f"/trips/{NONEXISTENT_TRIP_ID}/itinerary/{DATE_TITLIS}/suggest", headers={"X-API-Key": "test-key-12345"})
    assert response.status_code == 404


def test_suggest_day_not_found_returns_404() -> None:
    client = _suggest_client(day_found=False)
    response = client.post(f"/trips/{TRIP_ID}/itinerary/2026-01-01/suggest", headers={"X-API-Key": "test-key-12345"})
    assert response.status_code == 404


# 502: malformed Claude response

def test_malformed_json_from_claude_returns_502() -> None:
    mock_supabase = _make_suggest_supabase_mock()
    mock_claude = MagicMock()
    mock_content = MagicMock()
    mock_content.text = "here are some great ideas: Harder Kulm, boat tour, Jungfraujoch"
    mock_claude.messages.create.return_value.content = [mock_content]
    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    app.dependency_overrides[get_anthropic] = lambda: mock_claude
    client = TestClient(app)
    response = client.post(f"/trips/{TRIP_ID}/itinerary/{DATE_TITLIS}/suggest", headers={"X-API-Key": "test-key-12345"})
    assert response.status_code == 502


def test_markdown_fenced_json_from_claude_returns_200() -> None:
    mock_supabase = _make_suggest_supabase_mock()
    mock_claude = MagicMock()
    mock_content = MagicMock()
    mock_content.text = f"```json\n{json.dumps(VALID_SUGGESTIONS)}\n```"
    mock_claude.messages.create.return_value.content = [mock_content]
    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    app.dependency_overrides[get_anthropic] = lambda: mock_claude
    client = TestClient(app)
    response = client.post(f"/trips/{TRIP_ID}/itinerary/{DATE_TITLIS}/suggest", headers={"X-API-Key": "test-key-12345"})
    assert response.status_code == 200


def test_wrong_suggestion_count_returns_502() -> None:
    two_suggestions = VALID_SUGGESTIONS[:2]
    mock_supabase = _make_suggest_supabase_mock()
    mock_claude = MagicMock()
    mock_content = MagicMock()
    mock_content.text = json.dumps(two_suggestions)
    mock_claude.messages.create.return_value.content = [mock_content]
    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    app.dependency_overrides[get_anthropic] = lambda: mock_claude
    client = TestClient(app)
    response = client.post(f"/trips/{TRIP_ID}/itinerary/{DATE_TITLIS}/suggest", headers={"X-API-Key": "test-key-12345"})
    assert response.status_code == 502


# ── POST /trips/{trip_id}/itinerary ───────────────────────────────────────────

DATE_NEW = "2026-06-28"

MOCK_NEW_DAY = {
    "id": "new-day-uuid",
    "trip_id": TRIP_ID,
    "date": DATE_NEW,
    "city": "Interlaken",
    "country": "CH",
    "title": "Rest Day",
    "plan": "",
    "intensity": "light",
    "is_special": False,
    "special_label": None,
}

NEW_DAY_BODY = {
    "date": DATE_NEW,
    "city": "Interlaken",
    "country": "CH",
    "title": "Rest Day",
}


def _make_create_day_mock(trip_found: bool = True, date_taken: bool = False) -> MagicMock:
    mock = MagicMock()

    trip_response = MagicMock()
    trip_response.data = [{"id": TRIP_ID}] if trip_found else []

    existing_response = MagicMock()
    existing_response.data = [{"id": "existing-uuid"}] if date_taken else []

    insert_response = MagicMock()
    insert_response.data = [MOCK_NEW_DAY]

    def table_side_effect(table_name: str) -> MagicMock:
        chain = MagicMock()
        if table_name == "trips":
            chain.select.return_value.eq.return_value.execute.return_value = trip_response
        else:
            chain.select.return_value.eq.return_value.eq.return_value.execute.return_value = existing_response
            chain.insert.return_value.execute.return_value = insert_response
        return chain

    mock.table.side_effect = table_side_effect
    return mock


def _create_client(trip_found: bool = True, date_taken: bool = False) -> TestClient:
    app.dependency_overrides[get_supabase] = lambda: _make_create_day_mock(trip_found, date_taken)
    return TestClient(app)


def test_create_day_returns_201() -> None:
    client = _create_client()
    response = client.post(f"/trips/{TRIP_ID}/itinerary", json=NEW_DAY_BODY, headers={"X-API-Key": "test-key-12345"})
    assert response.status_code == 201


def test_create_day_returns_new_day_fields() -> None:
    client = _create_client()
    body = client.post(f"/trips/{TRIP_ID}/itinerary", json=NEW_DAY_BODY, headers={"X-API-Key": "test-key-12345"}).json()
    assert body["date"] == DATE_NEW
    assert body["city"] == "Interlaken"
    assert body["title"] == "Rest Day"


def test_create_day_nonexistent_trip_returns_404() -> None:
    client = _create_client(trip_found=False)
    response = client.post(f"/trips/{NONEXISTENT_TRIP_ID}/itinerary", json=NEW_DAY_BODY, headers={"X-API-Key": "test-key-12345"})
    assert response.status_code == 404


def test_create_day_duplicate_date_returns_409() -> None:
    client = _create_client(date_taken=True)
    response = client.post(f"/trips/{TRIP_ID}/itinerary", json=NEW_DAY_BODY, headers={"X-API-Key": "test-key-12345"})
    assert response.status_code == 409


def test_create_day_missing_required_fields_returns_422() -> None:
    client = _create_client()
    response = client.post(f"/trips/{TRIP_ID}/itinerary", json={"date": DATE_NEW}, headers={"X-API-Key": "test-key-12345"})
    assert response.status_code == 422


# ── DELETE /trips/{trip_id}/itinerary/{date} ──────────────────────────────────

def _make_delete_day_mock(trip_found: bool = True, day_found: bool = True) -> MagicMock:
    mock = MagicMock()

    trip_response = MagicMock()
    trip_response.data = [{"id": TRIP_ID}] if trip_found else []

    existing_response = MagicMock()
    existing_response.data = [{"id": "day-uuid"}] if day_found else []

    delete_response = MagicMock()
    delete_response.data = []

    def table_side_effect(table_name: str) -> MagicMock:
        chain = MagicMock()
        if table_name == "trips":
            chain.select.return_value.eq.return_value.execute.return_value = trip_response
        else:
            chain.select.return_value.eq.return_value.eq.return_value.execute.return_value = existing_response
            chain.delete.return_value.eq.return_value.eq.return_value.execute.return_value = delete_response
        return chain

    mock.table.side_effect = table_side_effect
    return mock


def _delete_client(trip_found: bool = True, day_found: bool = True) -> TestClient:
    app.dependency_overrides[get_supabase] = lambda: _make_delete_day_mock(trip_found, day_found)
    return TestClient(app)


def test_delete_day_returns_204() -> None:
    client = _delete_client()
    response = client.delete(f"/trips/{TRIP_ID}/itinerary/{DATE_JUN20}", headers={"X-API-Key": "test-key-12345"})
    assert response.status_code == 204


def test_delete_day_nonexistent_trip_returns_404() -> None:
    client = _delete_client(trip_found=False)
    response = client.delete(f"/trips/{NONEXISTENT_TRIP_ID}/itinerary/{DATE_JUN20}", headers={"X-API-Key": "test-key-12345"})
    assert response.status_code == 404


def test_delete_day_not_found_returns_404() -> None:
    client = _delete_client(day_found=False)
    response = client.delete(f"/trips/{TRIP_ID}/itinerary/{MISSING_DATE}", headers={"X-API-Key": "test-key-12345"})
    assert response.status_code == 404
