import os

from fastapi import APIRouter, Depends, HTTPException, Response
from supabase import Client, create_client

from app.models.itinerary import (
    Activity,
    Constraint,
    ConstraintCreate,
    Day,
    Goal,
    GoalCreate,
    GoalListUpdate,
    Itinerary,
)
from auth import require_admin_key

router = APIRouter(prefix="/api")


def get_supabase() -> Client:
    url = os.getenv("SUPABASE_URL", "")
    key = os.getenv("SUPABASE_KEY", "")
    return create_client(url, key)


def _get_trip_or_404(trip_id: str, supabase: Client) -> None:
    result = supabase.table("trips").select("id").eq("id", trip_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail=f"Trip {trip_id} not found")


# ── Goals ─────────────────────────────────────────────────────────────────────

@router.get("/trips/{trip_id}/goals", response_model=list[Goal])
def list_goals(
    trip_id: str,
    supabase: Client = Depends(get_supabase),
) -> list[Goal]:
    _get_trip_or_404(trip_id, supabase)
    result = supabase.table("trip_goals").select("*").eq("trip_id", trip_id).execute()
    return [Goal(**row) for row in result.data]


@router.post("/trips/{trip_id}/goals", response_model=Goal, status_code=201)
def create_goal(
    trip_id: str,
    body: GoalCreate,
    supabase: Client = Depends(get_supabase),
    _auth: None = Depends(require_admin_key),
) -> Goal:
    _get_trip_or_404(trip_id, supabase)
    existing = (
        supabase.table("trip_goals")
        .select("id")
        .eq("trip_id", trip_id)
        .eq("label", body.label)
        .execute()
    )
    if existing.data:
        raise HTTPException(
            status_code=409,
            detail=f"Goal '{body.label}' already exists for this trip",
        )
    row = {"trip_id": trip_id, "goal_type": body.goal_type, "label": body.label}
    result = supabase.table("trip_goals").insert(row).execute()
    return Goal(**result.data[0])


@router.put("/trips/{trip_id}/goals", response_model=list[Goal])
def bulk_upsert_goals(
    trip_id: str,
    body: GoalListUpdate,
    supabase: Client = Depends(get_supabase),
    _auth: None = Depends(require_admin_key),
) -> list[Goal]:
    _get_trip_or_404(trip_id, supabase)
    supabase.table("trip_goals").delete().eq("trip_id", trip_id).execute()
    rows = [
        {"trip_id": trip_id, "goal_type": g.goal_type, "label": g.label}
        for g in body.goals
    ]
    result = supabase.table("trip_goals").insert(rows).execute()
    return [Goal(**row) for row in result.data]


@router.delete("/trips/{trip_id}/goals/{goal_id}")
def delete_goal(
    trip_id: str,
    goal_id: str,
    supabase: Client = Depends(get_supabase),
    _auth: None = Depends(require_admin_key),
) -> Response:
    _get_trip_or_404(trip_id, supabase)
    existing = (
        supabase.table("trip_goals")
        .select("id")
        .eq("id", goal_id)
        .eq("trip_id", trip_id)
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail=f"Goal {goal_id} not found")
    supabase.table("trip_goals").delete().eq("id", goal_id).eq("trip_id", trip_id).execute()
    return Response(status_code=204)


# ── Constraints ───────────────────────────────────────────────────────────────

@router.get("/trips/{trip_id}/constraints", response_model=list[Constraint])
def list_constraints(
    trip_id: str,
    supabase: Client = Depends(get_supabase),
) -> list[Constraint]:
    _get_trip_or_404(trip_id, supabase)
    result = (
        supabase.table("trip_constraints").select("*").eq("trip_id", trip_id).execute()
    )
    return [Constraint(**row) for row in result.data]


@router.post("/trips/{trip_id}/constraints", response_model=Constraint, status_code=201)
def create_constraint(
    trip_id: str,
    body: ConstraintCreate,
    supabase: Client = Depends(get_supabase),
    _auth: None = Depends(require_admin_key),
) -> Constraint:
    _get_trip_or_404(trip_id, supabase)
    row = {
        "trip_id": trip_id,
        "constraint_type": body.constraint_type,
        "description": body.description,
        "value": body.value,
    }
    result = supabase.table("trip_constraints").insert(row).execute()
    return Constraint(**result.data[0])


@router.delete("/trips/{trip_id}/constraints/{constraint_id}")
def delete_constraint(
    trip_id: str,
    constraint_id: str,
    supabase: Client = Depends(get_supabase),
    _auth: None = Depends(require_admin_key),
) -> Response:
    _get_trip_or_404(trip_id, supabase)
    existing = (
        supabase.table("trip_constraints")
        .select("id")
        .eq("id", constraint_id)
        .eq("trip_id", trip_id)
        .execute()
    )
    if not existing.data:
        raise HTTPException(
            status_code=404, detail=f"Constraint {constraint_id} not found"
        )
    (
        supabase.table("trip_constraints")
        .delete()
        .eq("id", constraint_id)
        .eq("trip_id", trip_id)
        .execute()
    )
    return Response(status_code=204)


# ── Itinerary (read-only nested structure) ────────────────────────────────────

@router.get("/trips/{trip_id}/itinerary", response_model=Itinerary)
def get_itinerary(
    trip_id: str,
    supabase: Client = Depends(get_supabase),
) -> Itinerary:
    _get_trip_or_404(trip_id, supabase)

    days_result = (
        supabase.table("itinerary_days").select("*").eq("trip_id", trip_id).execute()
    )
    days_raw = days_result.data

    if days_raw:
        day_ids = [d["id"] for d in days_raw]
        acts_result = (
            supabase.table("itinerary_activities")
            .select("*")
            .in_("day_id", day_ids)
            .execute()
        )
        acts_raw = acts_result.data
    else:
        acts_raw = []

    goals_result = (
        supabase.table("trip_goals").select("*").eq("trip_id", trip_id).execute()
    )
    constraints_result = (
        supabase.table("trip_constraints").select("*").eq("trip_id", trip_id).execute()
    )

    acts_by_day: dict[str, list[Activity]] = {}
    for act in acts_raw:
        acts_by_day.setdefault(act["day_id"], []).append(Activity(**act))

    days = sorted(
        [
            Day(**{**d, "activities": acts_by_day.get(d["id"], [])})
            for d in days_raw
        ],
        key=lambda d: d.position,
    )

    return Itinerary(
        days=days,
        goals=[Goal(**g) for g in goals_result.data],
        constraints=[Constraint(**c) for c in constraints_result.data],
    )
