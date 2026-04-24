"""
Tests for migration 005: reconcile itinerary_days Phase 1 → Phase 2.

Verifies that the GET /api/trips/{trip_id}/itinerary route returns all 17 days
with position, day_type, and notes populated — the three columns added by 005.
"""

from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.routers.itinerary import get_supabase as itinerary_get_supabase
from main import app

TRIP_ID = "550e8400-e29b-41d4-a716-446655440000"
TIMESTAMP = "2026-04-24T00:00:00+00:00"

# 17 rows matching the Kura Europe 2026 seed data, post-migration shape.
# position is 1-based ordered by date; day_type backfilled to 'exploration';
# notes backfilled from the plan column.
_KURA_ROWS = [
    ("2026-06-19", "San Francisco",
     "Early check-in at SFO. Long-haul SFO→LHR flight departs today."),
    ("2026-06-20", "London",
     "Arrive LHR, transfer to Crowne Plaza Kings Cross. Light afternoon walk."),
    ("2026-06-21", "London",
     "Morning Borough Market. Walk across London Bridge. South Bank afternoon."),
    ("2026-06-22", "London",
     "Westminster, Big Ben, Natural History Museum."),
    ("2026-06-23", "Paris",
     "Morning Eurostar St Pancras → Gare du Nord. Explore Le Marais."),
    ("2026-06-24", "Paris",
     "Timed-entry Eiffel Tower. Picnic on Champ de Mars. Seine walk."),
    ("2026-06-25", "Paris",
     "Louvre 9am — Mona Lisa, Venus de Milo. Afternoon Musée d'Orsay."),
    ("2026-06-26", "Paris",
     "Montmartre, Sacré-Cœur. Anniversary dinner reservation."),
    ("2026-06-27", "Interlaken",
     "Birthday — TGV Paris→Basel, regional train Basel→Interlaken Ost."),
    ("2026-06-28", "Interlaken",
     "Boat cruise on Lake Brienz to Giessbach Falls."),
    ("2026-06-29", "Interlaken",
     "Train to Engelberg, Rotair cable car to Mt. Titlis (3020m)."),
    ("2026-06-30", "Interlaken",
     "Train to Grindelwald, hike Bachalpsee trail."),
    ("2026-07-01", "Interlaken",
     "Parents: tandem skydiving over Bernese Alps. Kids: hotel activity."),
    ("2026-07-02", "Milan",
     "Train Interlaken→Milan Centrale. Arrive afternoon. Navigli evening."),
    ("2026-07-03", "Milan",
     "Duomo rooftop. Galleria Vittorio Emanuele II. Brera afternoon."),
    ("2026-07-04", "Milan",
     "Flex day. Sforza Castle optional. Pack for departure."),
    ("2026-07-05", "Milan",
     "Early departure to Malpensa Airport. Long-haul MXP→SFO."),
]

MOCK_DAYS = [
    {
        "id": f"day-uuid-{i:02d}",
        "trip_id": TRIP_ID,
        "position": i,
        "date": date,
        "city": city,
        "day_type": "exploration",
        "notes": notes,
        "created_at": TIMESTAMP,
        "updated_at": TIMESTAMP,
    }
    for i, (date, city, notes) in enumerate(_KURA_ROWS, start=1)
]


def _make_mock_supabase() -> MagicMock:
    mock_sb = MagicMock()

    def table_side_effect(name: str) -> MagicMock:
        chain = MagicMock()
        if name == "trips":
            chain.select.return_value.eq.return_value.execute.return_value.data = [
                {"id": TRIP_ID}
            ]
        elif name == "itinerary_days":
            chain.select.return_value.eq.return_value.execute.return_value.data = (
                MOCK_DAYS
            )
        elif name == "itinerary_activities":
            chain.select.return_value.in_.return_value.execute.return_value.data = []
        else:
            # trip_goals, trip_constraints
            chain.select.return_value.eq.return_value.execute.return_value.data = []
        return chain

    mock_sb.table.side_effect = table_side_effect
    return mock_sb


def _make_client(mock_sb: MagicMock) -> TestClient:
    app.dependency_overrides[itinerary_get_supabase] = lambda: mock_sb
    return TestClient(app)


def teardown_function() -> None:
    app.dependency_overrides.clear()


# ── Tests ─────────────────────────────────────────────────────────────────────

def test_all_17_rows_returned() -> None:
    """After migration 005, all 17 itinerary days are returned."""
    client = _make_client(_make_mock_supabase())
    response = client.get(f"/api/trips/{TRIP_ID}/itinerary")
    assert response.status_code == 200
    days = response.json()["days"]
    assert len(days) == 17


def test_all_rows_have_position_populated() -> None:
    """All 17 rows have a non-null integer position after backfill."""
    client = _make_client(_make_mock_supabase())
    days = client.get(f"/api/trips/{TRIP_ID}/itinerary").json()["days"]
    for day in days:
        assert day["position"] is not None, f"day {day['id']} missing position"
        assert isinstance(day["position"], int)


def test_positions_are_sequential_1_to_17() -> None:
    """Positions form the set {1..17} — no gaps, no duplicates."""
    client = _make_client(_make_mock_supabase())
    days = client.get(f"/api/trips/{TRIP_ID}/itinerary").json()["days"]
    positions = {day["position"] for day in days}
    assert positions == set(range(1, 18))


def test_all_rows_have_day_type_exploration() -> None:
    """All rows are backfilled with day_type='exploration'."""
    client = _make_client(_make_mock_supabase())
    days = client.get(f"/api/trips/{TRIP_ID}/itinerary").json()["days"]
    for day in days:
        assert day["day_type"] == "exploration", (
            f"day {day['id']} has day_type={day['day_type']!r}, expected 'exploration'"
        )


def test_all_rows_have_notes_populated() -> None:
    """All rows have notes backfilled from the plan column — non-null and non-empty."""
    client = _make_client(_make_mock_supabase())
    days = client.get(f"/api/trips/{TRIP_ID}/itinerary").json()["days"]
    for day in days:
        assert day["notes"] is not None, f"day {day['id']} missing notes"
        assert day["notes"] != "", f"day {day['id']} has empty notes"


def test_days_sorted_by_position() -> None:
    """Route returns days sorted by position ascending."""
    client = _make_client(_make_mock_supabase())
    days = client.get(f"/api/trips/{TRIP_ID}/itinerary").json()["days"]
    positions = [day["position"] for day in days]
    assert positions == sorted(positions)
