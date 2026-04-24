"""Measure prompt token budget for the itinerary advisor.

Builds a mock 14-day, 4-city, 3-activities-per-day trip and prints the
token estimate alongside the full rendered prompt.

Run:
    cd apps/api && venv/bin/python scripts/measure_prompt_tokens.py
"""
import sys
from pathlib import Path

API_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(API_ROOT))

from app.prompts.itinerary_advisor import build_advisor_prompt, token_estimate

# ── Mock trip data ────────────────────────────────────────────────────────────

CITIES = [
    ("London", "UK"),
    ("Paris", "France"),
    ("Interlaken", "CH"),
    ("Milan", "Italy"),
]

ACTIVITIES_BY_CITY: dict[str, list[dict]] = {
    "London": [
        {"title": "Tower of London tour", "time_slot": "morning",
         "category": "sightseeing", "estimated_cost": 35.0, "notes": None},
        {"title": "Borough Market food walk", "time_slot": "afternoon",
         "category": "food", "estimated_cost": 40.0, "notes": "Halal options available"},
        {"title": "South Bank evening stroll", "time_slot": "evening",
         "category": "sightseeing", "estimated_cost": 0.0, "notes": None},
    ],
    "Paris": [
        {"title": "Eiffel Tower visit", "time_slot": "morning",
         "category": "sightseeing", "estimated_cost": 60.0, "notes": "Book in advance"},
        {"title": "Champ de Mars picnic", "time_slot": "afternoon",
         "category": "food", "estimated_cost": 25.0, "notes": None},
        {"title": "Seine river cruise", "time_slot": "evening",
         "category": "activity", "estimated_cost": 20.0, "notes": None},
    ],
    "Interlaken": [
        {"title": "Titlis mountain cable car", "time_slot": "morning",
         "category": "activity", "estimated_cost": 120.0, "notes": "Family rate"},
        {"title": "Lake Brienz boat tour", "time_slot": "afternoon",
         "category": "activity", "estimated_cost": 45.0, "notes": None},
        {"title": "Grindelwald village walk", "time_slot": "evening",
         "category": "sightseeing", "estimated_cost": 0.0, "notes": None},
    ],
    "Milan": [
        {"title": "Duomo rooftop", "time_slot": "morning",
         "category": "sightseeing", "estimated_cost": 20.0, "notes": "Book early"},
        {"title": "Brera art gallery", "time_slot": "afternoon",
         "category": "sightseeing", "estimated_cost": 15.0, "notes": None},
        {"title": "Navigli canal evening", "time_slot": "evening",
         "category": "food", "estimated_cost": 50.0, "notes": None},
    ],
}

INTENSITIES = ["light", "moderate", "busy", "travel"]

days_per_city = [4, 4, 3, 3]  # 14 days total

MOCK_DAYS: list[dict] = []
day_index = 0
for (city, country), n_days in zip(CITIES, days_per_city):
    for i in range(n_days):
        date = f"2026-06-{20 + day_index:02d}" if day_index < 11 else f"2026-07-{day_index - 10:02d}"
        intensity = INTENSITIES[i % len(INTENSITIES)]
        acts = ACTIVITIES_BY_CITY[city]
        MOCK_DAYS.append({
            "id": f"day-{city.lower()}-{i+1}",
            "date": date,
            "city": city,
            "country": country,
            "title": f"{city} day {i + 1}",
            "plan": ", ".join(a["title"] for a in acts),
            "intensity": intensity,
            "is_special": False,
            "special_label": None,
            "activities": acts,
        })
        day_index += 1

MOCK_GOALS = [
    {"id": "g1", "trip_id": "mock-trip", "goal_type": "preset",
     "label": "See major European landmarks", "created_at": "2026-01-01T00:00:00Z"},
    {"id": "g2", "trip_id": "mock-trip", "goal_type": "preset",
     "label": "Kid-friendly activities every day", "created_at": "2026-01-01T00:00:00Z"},
    {"id": "g3", "trip_id": "mock-trip", "goal_type": "custom",
     "label": "At least one light/rest day per city", "created_at": "2026-01-01T00:00:00Z"},
]

MOCK_CONSTRAINTS = [
    {"id": "c1", "trip_id": "mock-trip", "constraint_type": "budget_cap",
     "description": "Total trip budget", "value": 25000.0,
     "created_at": "2026-01-01T00:00:00Z"},
    {"id": "c2", "trip_id": "mock-trip", "constraint_type": "must_visit",
     "description": "Eiffel Tower", "value": None,
     "created_at": "2026-01-01T00:00:00Z"},
    {"id": "c3", "trip_id": "mock-trip", "constraint_type": "must_visit",
     "description": "Titlis mountain", "value": None,
     "created_at": "2026-01-01T00:00:00Z"},
    {"id": "c4", "trip_id": "mock-trip", "constraint_type": "must_avoid",
     "description": "beef", "value": None,
     "created_at": "2026-01-01T00:00:00Z"},
]

total_cost = sum(
    a["estimated_cost"]
    for d in MOCK_DAYS
    for a in d["activities"]
)

MOCK_CONSTRAINT_STATUS = [
    {"constraint_id": "c1", "type": "budget_cap",
     "description": "Total trip budget",
     "status": "satisfied" if total_cost <= 25000 else "violated"},
    {"constraint_id": "c2", "type": "must_visit",
     "description": "Eiffel Tower", "status": "satisfied"},
    {"constraint_id": "c3", "type": "must_visit",
     "description": "Titlis mountain", "status": "satisfied"},
    {"constraint_id": "c4", "type": "must_avoid",
     "description": "beef", "status": "satisfied"},
]

MOCK_CONTEXT = {
    "goals": MOCK_GOALS,
    "constraints": MOCK_CONSTRAINTS,
    "days": MOCK_DAYS,
    "summary": {
        "total_days": len(MOCK_DAYS),
        "total_estimated_cost": total_cost,
        "cities": [c for c, _ in CITIES],
        "constraint_status": MOCK_CONSTRAINT_STATUS,
    },
}

MUTATION = (
    "Add a Versailles day trip on the third Paris day "
    "(full-day bus tour, ~$120/person, intensity: busy)."
)

# ── Render and measure ────────────────────────────────────────────────────────

if __name__ == "__main__":
    import warnings

    warnings.simplefilter("always")

    prompt = build_advisor_prompt(MOCK_CONTEXT, MUTATION)
    estimate = token_estimate(prompt)

    sep = "=" * 72
    print(sep)
    print(f"Trip:           {len(MOCK_DAYS)} days, {len(CITIES)} cities, "
          f"{len(MOCK_DAYS) * 3} activities")
    print(f"Prompt length:  {len(prompt):,} characters")
    print(f"Word count:     {len(prompt.split()):,}")
    print(f"Token estimate: ~{estimate:,}  (word_count × 1.3)")
    print(sep)
    print()
    print(prompt)
