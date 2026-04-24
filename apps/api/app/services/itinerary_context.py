"""Context builder for the itinerary advisor prompt.

Used by both the suggestion engine and the chat handler — keep it generic.
"""
from __future__ import annotations

from typing import Any

from supabase import Client


def _check_constraint(
    constraint: dict[str, Any],
    total_estimated_cost: float,
    total_days: int,
    days: list[dict[str, Any]],
) -> dict[str, Any]:
    """Run a deterministic check for one constraint and return its status entry."""
    ctype: str = constraint.get("constraint_type", "custom")
    value: float | None = constraint.get("value")
    description: str = constraint.get("description", "")

    base = {
        "constraint_id": constraint.get("id"),
        "type": ctype,
        "description": description,
    }

    if ctype == "budget_cap" and value is not None:
        status = "satisfied" if total_estimated_cost <= value else "violated"
        return {**base, "status": status}

    if ctype == "must_visit":
        search = description.lower()
        found = any(
            search in (d.get("city") or "").lower()
            or search in (d.get("title") or "").lower()
            or search in (d.get("plan") or "").lower()
            or any(
                search in (a.get("title") or "").lower()
                for a in d.get("activities", [])
            )
            for d in days
        )
        return {**base, "status": "satisfied" if found else "violated"}

    if ctype == "must_avoid":
        search = description.lower()
        found = any(
            search in (d.get("title") or "").lower()
            or search in (d.get("plan") or "").lower()
            or any(
                search in (a.get("title") or "").lower()
                for a in d.get("activities", [])
            )
            for d in days
        )
        # "satisfied" means the thing to avoid is absent
        return {**base, "status": "violated" if found else "satisfied"}

    if ctype == "time_constraint" and value is not None:
        status = "satisfied" if total_days <= int(value) else "violated"
        return {**base, "status": status}

    return {**base, "status": "unknown"}


def build_itinerary_context(trip_id: str, supabase_client: Client) -> dict[str, Any]:
    """Fetch goals, constraints, days, and activities from Supabase and return a
    structured context dict for the itinerary advisor prompt."""

    goals_result = (
        supabase_client.table("trip_goals")
        .select("*")
        .eq("trip_id", trip_id)
        .execute()
    )
    goals: list[dict[str, Any]] = goals_result.data

    constraints_result = (
        supabase_client.table("trip_constraints")
        .select("*")
        .eq("trip_id", trip_id)
        .execute()
    )
    constraints: list[dict[str, Any]] = constraints_result.data

    days_result = (
        supabase_client.table("itinerary_days")
        .select("*")
        .eq("trip_id", trip_id)
        .execute()
    )
    days_raw: list[dict[str, Any]] = days_result.data

    activities_by_day: dict[str, list[dict[str, Any]]] = {}
    if days_raw:
        day_ids = [d["id"] for d in days_raw]
        acts_result = (
            supabase_client.table("itinerary_activities")
            .select("*")
            .in_("day_id", day_ids)
            .execute()
        )
        for act in acts_result.data:
            activities_by_day.setdefault(act["day_id"], []).append(act)

    bookings_result = (
        supabase_client.table("bookings")
        .select("*")
        .eq("trip_id", trip_id)
        .execute()
    )
    total_estimated_cost: float = sum(
        float(b.get("estimated_cost") or 0) for b in bookings_result.data
    )

    days: list[dict[str, Any]] = []
    seen_cities: list[str] = []

    sort_key = lambda d: (d.get("date") or "", d.get("position") or 0)  # noqa: E731
    for d in sorted(days_raw, key=sort_key):
        acts = sorted(
            activities_by_day.get(d["id"], []),
            key=lambda a: a.get("position", 0),
        )
        city: str | None = d.get("city")
        if city and city not in seen_cities:
            seen_cities.append(city)
        days.append({
            "id": d["id"],
            "date": d.get("date"),
            "city": city,
            "country": d.get("country"),
            "title": d.get("title"),
            "plan": d.get("plan"),
            "intensity": d.get("intensity"),
            "is_special": d.get("is_special", False),
            "special_label": d.get("special_label"),
            "activities": [
                {
                    "title": a.get("title"),
                    "time_slot": a.get("time_slot"),
                    "category": a.get("category"),
                    "estimated_cost": a.get("estimated_cost"),
                    "notes": a.get("notes"),
                }
                for a in acts
            ],
        })

    total_days = len(days)
    constraint_status = [
        _check_constraint(c, total_estimated_cost, total_days, days)
        for c in constraints
    ]

    return {
        "goals": goals,
        "constraints": constraints,
        "days": days,
        "summary": {
            "total_days": total_days,
            "total_estimated_cost": total_estimated_cost,
            "cities": seen_cities,
            "constraint_status": constraint_status,
        },
    }
