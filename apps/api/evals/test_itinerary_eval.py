"""Eval + deterministic tests for the itinerary advisor prompt pipeline.

AI-driven tests are marked @pytest.mark.skip until validate_mutation is
implemented in Phase 2. The four deterministic tests at the bottom run now
and test the context builder directly.
"""
import sys
from pathlib import Path
from unittest.mock import MagicMock

import pytest

API_ROOT = Path(__file__).parent.parent
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from app.services.itinerary_context import build_itinerary_context

# Imported from conftest (set at session start).
from evals.conftest import JUDGE_MODEL  # noqa: F401 — kept for DeepEval metrics in Phase 2

TRIP_ID = "550e8400-e29b-41d4-a716-446655440000"

# ── Mock helpers ──────────────────────────────────────────────────────────────

LONDON_DAY = {
    "id": "day-london-1",
    "trip_id": TRIP_ID,
    "date": "2026-06-21",
    "city": "London",
    "country": "UK",
    "title": "London Bridge & Borough Market",
    "plan": "London Bridge, Borough Market, South Bank walk",
    "intensity": "moderate",
    "is_special": False,
    "special_label": None,
}

PARIS_DAY = {
    "id": "day-paris-1",
    "trip_id": TRIP_ID,
    "date": "2026-06-24",
    "city": "Paris",
    "country": "France",
    "title": "Eiffel Tower & Champ de Mars",
    "plan": "Eiffel Tower visit, Champ de Mars picnic, Seine walk",
    "intensity": "busy",
    "is_special": False,
    "special_label": None,
}


def _make_supabase_mock(
    goals: list[dict],
    constraints: list[dict],
    days: list[dict],
    activities: list[dict],
    bookings: list[dict],
) -> MagicMock:
    """Return a MagicMock Supabase client wired to return the provided data."""
    mock_client = MagicMock()

    def table_side_effect(table_name: str) -> MagicMock:
        table_mock = MagicMock()
        if table_name == "trip_goals":
            result = MagicMock()
            result.data = goals
            table_mock.select.return_value.eq.return_value.execute.return_value = result
        elif table_name == "trip_constraints":
            result = MagicMock()
            result.data = constraints
            table_mock.select.return_value.eq.return_value.execute.return_value = result
        elif table_name == "itinerary_days":
            result = MagicMock()
            result.data = days
            table_mock.select.return_value.eq.return_value.execute.return_value = result
        elif table_name == "itinerary_activities":
            result = MagicMock()
            result.data = activities
            table_mock.select.return_value.in_.return_value.execute.return_value = result
        elif table_name == "bookings":
            result = MagicMock()
            result.data = bookings
            table_mock.select.return_value.eq.return_value.execute.return_value = result
        return table_mock

    mock_client.table.side_effect = table_side_effect
    return mock_client


# ── Skipped AI eval tests (Phase 2) ──────────────────────────────────────────

@pytest.mark.skip(reason="AI advisor not implemented yet — Phase 2")
def test_validation_ok_01() -> None:
    """Adding a free walking tour to a London day should return 'ok'."""
    from app.services.itinerary_advisor import validate_mutation  # type: ignore[import]
    from deepeval import assert_test
    from deepeval.metrics import GEval
    from deepeval.test_case import LLMTestCase, LLMTestCaseParams

    mock_supabase = _make_supabase_mock(
        goals=[{"id": "g1", "trip_id": TRIP_ID, "goal_type": "preset",
                "label": "See major landmarks", "created_at": "2026-01-01T00:00:00Z"}],
        constraints=[{"id": "c1", "trip_id": TRIP_ID, "constraint_type": "budget_cap",
                      "description": "Stay under $25,000", "value": 25000.0,
                      "created_at": "2026-01-01T00:00:00Z"}],
        days=[LONDON_DAY],
        activities=[],
        bookings=[{"estimated_cost": 100, "status": "pending"}],
    )
    context = build_itinerary_context(TRIP_ID, mock_supabase)
    mutation = "Add a free walking tour of Shoreditch on the afternoon of Jun 21"
    result = validate_mutation(context, mutation)

    assert result["status"] == "ok"
    assert result["affected_constraints"] == []

    test_case = LLMTestCase(
        input=mutation,
        actual_output=str(result),
        expected_output='{"status": "ok", "affected_constraints": []}',
    )
    judge_kwargs = {"model": JUDGE_MODEL} if JUDGE_MODEL is not None else {}
    assert_test(test_case, [
        GEval(
            name="ValidationOk",
            criteria="Status is 'ok' and no constraints are flagged for a zero-cost, low-intensity addition.",
            evaluation_params=[LLMTestCaseParams.ACTUAL_OUTPUT],
            threshold=0.8,
            **judge_kwargs,
        )
    ])


@pytest.mark.skip(reason="AI advisor not implemented yet — Phase 2")
def test_validation_ok_02() -> None:
    """Reordering two days within the same city should return 'ok'."""
    from app.services.itinerary_advisor import validate_mutation  # type: ignore[import]

    mock_supabase = _make_supabase_mock(
        goals=[], constraints=[], days=[LONDON_DAY, PARIS_DAY], activities=[], bookings=[]
    )
    context = build_itinerary_context(TRIP_ID, mock_supabase)
    mutation = "Swap Jun 20 and Jun 21 — move the South Bank walk to day 1 and rest to day 2"
    result = validate_mutation(context, mutation)

    assert result["status"] == "ok"
    assert result["affected_constraints"] == []


@pytest.mark.skip(reason="AI advisor not implemented yet — Phase 2")
def test_validation_warn_01() -> None:
    """Adding a $250/person dinner when budget is near the cap should return 'warning'."""
    from app.services.itinerary_advisor import validate_mutation  # type: ignore[import]

    mock_supabase = _make_supabase_mock(
        goals=[],
        constraints=[{"id": "c1", "trip_id": TRIP_ID, "constraint_type": "budget_cap",
                      "description": "Stay under $300/day average", "value": 300.0,
                      "created_at": "2026-01-01T00:00:00Z"}],
        days=[PARIS_DAY],
        activities=[],
        bookings=[{"estimated_cost": 280, "status": "pending"}],
    )
    context = build_itinerary_context(TRIP_ID, mock_supabase)
    mutation = "Add dinner at Le Cinq (€250/person) on Jun 24 evening in Paris"
    result = validate_mutation(context, mutation)

    assert result["status"] == "warning"
    assert len(result["affected_constraints"]) >= 1


@pytest.mark.skip(reason="AI advisor not implemented yet — Phase 2")
def test_validation_warn_02() -> None:
    """Adding a 4th activity on a 'busy' day should return 'warning'."""
    from app.services.itinerary_advisor import validate_mutation  # type: ignore[import]

    eiffel_act = {"id": "a1", "day_id": "day-paris-1", "position": 1,
                  "title": "Eiffel Tower", "time_slot": "morning",
                  "category": "sightseeing", "estimated_cost": 60.0, "notes": None,
                  "created_at": "2026-01-01T00:00:00Z"}
    louvre_act = {"id": "a2", "day_id": "day-paris-1", "position": 2,
                  "title": "Louvre Museum", "time_slot": "afternoon",
                  "category": "sightseeing", "estimated_cost": 22.0, "notes": None,
                  "created_at": "2026-01-01T00:00:00Z"}
    seine_act = {"id": "a3", "day_id": "day-paris-1", "position": 3,
                 "title": "Seine River cruise", "time_slot": "evening",
                 "category": "activity", "estimated_cost": 15.0, "notes": None,
                 "created_at": "2026-01-01T00:00:00Z"}
    mock_supabase = _make_supabase_mock(
        goals=[], constraints=[], days=[PARIS_DAY],
        activities=[eiffel_act, louvre_act, seine_act], bookings=[]
    )
    context = build_itinerary_context(TRIP_ID, mock_supabase)
    mutation = "Add a Versailles day trip on Jun 24 (already has Eiffel, Louvre, and Seine)"
    result = validate_mutation(context, mutation)

    assert result["status"] == "warning"


@pytest.mark.skip(reason="AI advisor not implemented yet — Phase 2")
def test_validation_violation_01() -> None:
    """Removing the only day in a must_visit city should return 'violation' with 2+ options."""
    from app.services.itinerary_advisor import validate_mutation  # type: ignore[import]

    mock_supabase = _make_supabase_mock(
        goals=[],
        constraints=[{"id": "c1", "trip_id": TRIP_ID, "constraint_type": "must_visit",
                      "description": "Eiffel Tower", "value": None,
                      "created_at": "2026-01-01T00:00:00Z"}],
        days=[PARIS_DAY],
        activities=[],
        bookings=[],
    )
    context = build_itinerary_context(TRIP_ID, mock_supabase)
    mutation = "Remove Jun 24 (Paris — Eiffel Tower day) to save time"
    result = validate_mutation(context, mutation)

    assert result["status"] == "violation"
    assert len(result["suggestions"]) >= 2


@pytest.mark.skip(reason="AI advisor not implemented yet — Phase 2")
def test_validation_violation_02() -> None:
    """Adding bookings that push total over the budget_cap should return 'violation'."""
    from app.services.itinerary_advisor import validate_mutation  # type: ignore[import]

    mock_supabase = _make_supabase_mock(
        goals=[],
        constraints=[{"id": "c1", "trip_id": TRIP_ID, "constraint_type": "budget_cap",
                      "description": "Trip budget cap", "value": 1000.0,
                      "created_at": "2026-01-01T00:00:00Z"}],
        days=[PARIS_DAY],
        activities=[],
        bookings=[{"estimated_cost": 950, "status": "pending"}],
    )
    context = build_itinerary_context(TRIP_ID, mock_supabase)
    mutation = "Add a private helicopter tour of Paris for $500 on Jun 24"
    result = validate_mutation(context, mutation)

    assert result["status"] == "violation"
    assert any("budget" in s["description"].lower() for s in result["suggestions"])


@pytest.mark.skip(reason="AI advisor not implemented yet — Phase 2")
def test_suggestion_01() -> None:
    """When over budget, suggestions should include at least one cost-reduction option."""
    from app.services.itinerary_advisor import validate_mutation  # type: ignore[import]

    mock_supabase = _make_supabase_mock(
        goals=[],
        constraints=[{"id": "c1", "trip_id": TRIP_ID, "constraint_type": "budget_cap",
                      "description": "Trip budget cap", "value": 500.0,
                      "created_at": "2026-01-01T00:00:00Z"}],
        days=[PARIS_DAY],
        activities=[],
        bookings=[{"estimated_cost": 480, "status": "pending"}],
    )
    context = build_itinerary_context(TRIP_ID, mock_supabase)
    mutation = "Add a Michelin-starred dinner at Septime ($300 for 4) on Jun 26"
    result = validate_mutation(context, mutation)

    suggestions = result["suggestions"]
    assert any(
        "cost" in s["description"].lower() or "cheaper" in s["description"].lower()
        for s in suggestions
    )


@pytest.mark.skip(reason="AI advisor not implemented yet — Phase 2")
def test_suggestion_02() -> None:
    """When a day has an empty afternoon, a goal-aligned activity should be suggested."""
    from app.services.itinerary_advisor import validate_mutation  # type: ignore[import]

    morning_act = {"id": "a1", "day_id": "day-london-1", "position": 1,
                   "title": "Borough Market", "time_slot": "morning",
                   "category": "food", "estimated_cost": 30.0, "notes": None,
                   "created_at": "2026-01-01T00:00:00Z"}
    mock_supabase = _make_supabase_mock(
        goals=[{"id": "g1", "trip_id": TRIP_ID, "goal_type": "preset",
                "label": "Explore local culture", "created_at": "2026-01-01T00:00:00Z"}],
        constraints=[],
        days=[LONDON_DAY],
        activities=[morning_act],
        bookings=[],
    )
    context = build_itinerary_context(TRIP_ID, mock_supabase)
    mutation = "Jun 21 afternoon is empty — what should we add?"
    result = validate_mutation(context, mutation)

    assert result["status"] in ("ok", "warning")
    assert len(result["suggestions"]) >= 1


@pytest.mark.skip(reason="AI advisor not implemented yet — Phase 2")
def test_resolution_01() -> None:
    """Violating must_visit should produce 2+ concrete relocation options."""
    from app.services.itinerary_advisor import validate_mutation  # type: ignore[import]

    mock_supabase = _make_supabase_mock(
        goals=[],
        constraints=[{"id": "c1", "trip_id": TRIP_ID, "constraint_type": "must_visit",
                      "description": "Interlaken Titlis mountain", "value": None,
                      "created_at": "2026-01-01T00:00:00Z"}],
        days=[LONDON_DAY, PARIS_DAY],
        activities=[],
        bookings=[],
    )
    context = build_itinerary_context(TRIP_ID, mock_supabase)
    mutation = "Drop the Interlaken leg entirely to save on Swiss hotel costs"
    result = validate_mutation(context, mutation)

    assert result["status"] == "violation"
    relocation_options = [
        s for s in result["suggestions"] if s["type"] in ("relocation", "modification")
    ]
    assert len(relocation_options) >= 2


# ── Live deterministic tests ─────────────────────────────────────────────────

def test_constraint_budget_satisfied() -> None:
    """Context builder marks budget_cap as 'satisfied' when total < cap."""
    bookings = [
        {"estimated_cost": 300.0, "status": "pending"},
        {"estimated_cost": 150.0, "status": "pending"},
    ]
    cap = 1000.0
    mock_supabase = _make_supabase_mock(
        goals=[],
        constraints=[{
            "id": "c-budget", "trip_id": TRIP_ID,
            "constraint_type": "budget_cap",
            "description": "Stay under $1,000",
            "value": cap,
            "created_at": "2026-01-01T00:00:00Z",
        }],
        days=[LONDON_DAY],
        activities=[],
        bookings=bookings,
    )
    context = build_itinerary_context(TRIP_ID, mock_supabase)

    total = context["summary"]["total_estimated_cost"]
    constraint_value = context["constraints"][0]["value"]
    status_entry = context["summary"]["constraint_status"][0]

    # Assert formula, not scalar: total < cap → satisfied
    assert total <= constraint_value, f"expected total {total} <= cap {constraint_value}"
    assert status_entry["status"] == "satisfied"


def test_constraint_budget_violated() -> None:
    """Context builder marks budget_cap as 'violated' when total > cap."""
    bookings = [
        {"estimated_cost": 800.0, "status": "pending"},
        {"estimated_cost": 400.0, "status": "pending"},
    ]
    cap = 1000.0
    mock_supabase = _make_supabase_mock(
        goals=[],
        constraints=[{
            "id": "c-budget", "trip_id": TRIP_ID,
            "constraint_type": "budget_cap",
            "description": "Stay under $1,000",
            "value": cap,
            "created_at": "2026-01-01T00:00:00Z",
        }],
        days=[LONDON_DAY],
        activities=[],
        bookings=bookings,
    )
    context = build_itinerary_context(TRIP_ID, mock_supabase)

    total = context["summary"]["total_estimated_cost"]
    constraint_value = context["constraints"][0]["value"]
    status_entry = context["summary"]["constraint_status"][0]

    # Assert formula: total > cap → violated
    assert total > constraint_value, f"expected total {total} > cap {constraint_value}"
    assert status_entry["status"] == "violated"


def test_constraint_must_visit_satisfied() -> None:
    """Context builder marks must_visit as 'satisfied' when the city/activity is present."""
    mock_supabase = _make_supabase_mock(
        goals=[],
        constraints=[{
            "id": "c-visit", "trip_id": TRIP_ID,
            "constraint_type": "must_visit",
            "description": "Eiffel Tower",
            "value": None,
            "created_at": "2026-01-01T00:00:00Z",
        }],
        days=[PARIS_DAY],  # plan contains "Eiffel Tower"
        activities=[],
        bookings=[],
    )
    context = build_itinerary_context(TRIP_ID, mock_supabase)

    status_entry = context["summary"]["constraint_status"][0]
    search_term = context["constraints"][0]["description"].lower()

    # Assert formula: search term appears somewhere in the itinerary → satisfied
    matched = any(
        search_term in (d.get("plan") or "").lower()
        or search_term in (d.get("title") or "").lower()
        or search_term in (d.get("city") or "").lower()
        or any(search_term in (a.get("title") or "").lower() for a in d.get("activities", []))
        for d in context["days"]
    )
    assert matched, "Eiffel Tower should appear in PARIS_DAY plan or title"
    assert status_entry["status"] == "satisfied"


def test_constraint_must_visit_violated() -> None:
    """Context builder marks must_visit as 'violated' when no matching city/activity exists."""
    mock_supabase = _make_supabase_mock(
        goals=[],
        constraints=[{
            "id": "c-visit", "trip_id": TRIP_ID,
            "constraint_type": "must_visit",
            "description": "Tokyo Skytree",
            "value": None,
            "created_at": "2026-01-01T00:00:00Z",
        }],
        days=[LONDON_DAY, PARIS_DAY],  # no Tokyo
        activities=[],
        bookings=[],
    )
    context = build_itinerary_context(TRIP_ID, mock_supabase)

    status_entry = context["summary"]["constraint_status"][0]
    search_term = context["constraints"][0]["description"].lower()

    # Assert formula: search term absent from all days → violated
    matched = any(
        search_term in (d.get("plan") or "").lower()
        or search_term in (d.get("title") or "").lower()
        or search_term in (d.get("city") or "").lower()
        or any(search_term in (a.get("title") or "").lower() for a in d.get("activities", []))
        for d in context["days"]
    )
    assert not matched, "Tokyo Skytree should not appear in LONDON or PARIS days"
    assert status_entry["status"] == "violated"
