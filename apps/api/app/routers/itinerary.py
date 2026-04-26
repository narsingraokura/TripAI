import json
import os
import re

import anthropic
from fastapi import APIRouter, Depends, HTTPException, Response
from supabase import Client, create_client

from app.models.itinerary import (
    Activity,
    Constraint,
    ConstraintCreate,
    Day,
    DayCreate,
    Goal,
    GoalCreate,
    GoalListUpdate,
    Itinerary,
    ResolveRequest,
    ResolveSuggestion,
    ValidateRequest,
    ValidationResult,
)
from auth import require_admin_key

router = APIRouter(prefix="/api")


def get_supabase() -> Client:
    url = os.getenv("SUPABASE_URL", "")
    key = os.getenv("SUPABASE_KEY", "")
    return create_client(url, key)


def get_anthropic() -> anthropic.Anthropic:
    return anthropic.Anthropic()


VALIDATE_SYSTEM_PROMPT = """\
You are a trip planning advisor for the Kura family Europe 2026 trip.

Given the current itinerary state and a proposed change, evaluate whether the change \
aligns with or violates the trip's goals and constraints.

Rules:
- If no goals or constraints are set, respond with status "ok"
- "ok": change fits or is neutral
- "warning": minor concern — proceed with awareness
- "violation": directly conflicts with a stated goal or constraint

Respond ONLY with a JSON object — no prose, no markdown fences:
{"status": "ok" | "warning" | "violation", "message": "<one sentence, max 120 chars>"}
"""


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

def _fetch_itinerary(trip_id: str, supabase: Client) -> Itinerary:
    """Build the full Itinerary response without a trip-exists check."""
    days_raw = (
        supabase.table("itinerary_days").select("*").eq("trip_id", trip_id).execute().data
    )
    if days_raw:
        day_ids = [d["id"] for d in days_raw]
        acts_raw = (
            supabase.table("itinerary_activities")
            .select("*")
            .in_("day_id", day_ids)
            .execute()
            .data
        )
    else:
        acts_raw = []

    goals_raw = (
        supabase.table("trip_goals").select("*").eq("trip_id", trip_id).execute().data
    )
    constraints_raw = (
        supabase.table("trip_constraints").select("*").eq("trip_id", trip_id).execute().data
    )

    acts_by_day: dict[str, list[Activity]] = {}
    for act in acts_raw:
        acts_by_day.setdefault(act["day_id"], []).append(Activity(**act))

    days = sorted(
        [Day(**{**d, "activities": acts_by_day.get(d["id"], [])}) for d in days_raw],
        key=lambda d: d.position,
    )
    return Itinerary(
        days=days,
        goals=[Goal(**g) for g in goals_raw],
        constraints=[Constraint(**c) for c in constraints_raw],
    )


@router.get("/trips/{trip_id}/itinerary", response_model=Itinerary)
def get_itinerary(
    trip_id: str,
    supabase: Client = Depends(get_supabase),
) -> Itinerary:
    _get_trip_or_404(trip_id, supabase)
    return _fetch_itinerary(trip_id, supabase)


# ── Add day (position-based insert with re-indexing) ──────────────────────────

@router.post("/trips/{trip_id}/itinerary/days", response_model=Day, status_code=201)
def add_itinerary_day(
    trip_id: str,
    body: DayCreate,
    supabase: Client = Depends(get_supabase),
    _auth: None = Depends(require_admin_key),
) -> Day:
    _get_trip_or_404(trip_id, supabase)

    # Fetch all days that must shift up (position >= insertion point).
    affected = (
        supabase.table("itinerary_days")
        .select("*")
        .eq("trip_id", trip_id)
        .gte("position", body.position)
        .execute()
    )

    # Shift affected days up by 1. Done as a single upsert to minimise round-trips.
    # Not truly atomic with the insert below; acceptable for a single-user app.
    # To make this transactional, define a Postgres RPC function.
    #
    # IMPORTANT: sort descending so PostgREST's INSERT … ON CONFLICT processes the
    # highest position first.  Without this ordering the unique(trip_id, position)
    # constraint fires mid-batch: row A is moved to position N+1 while row B still
    # occupies N+1, causing a violation before B has a chance to shift.
    if affected.data:
        shifted = sorted(
            [{**row, "position": row["position"] + 1} for row in affected.data],
            key=lambda r: r["position"],
            reverse=True,
        )
        supabase.table("itinerary_days").upsert(shifted).execute()

    # Insert the new day. Supply legacy Phase-1 columns so NOT NULL constraints pass.
    row: dict = {
        "trip_id": trip_id,
        "position": body.position,
        "date": body.date,
        "city": body.city,
        "country": "",
        "title": body.city or "New day",
        "plan": body.notes or "",
        "intensity": "light",
        "is_special": False,
        "day_type": body.day_type,
        "notes": body.notes,
    }
    result = supabase.table("itinerary_days").insert(row).execute()
    return Day(**{**result.data[0], "activities": []})


# ── Validate mutation against trip goals / constraints ────────────────────────

def _build_itinerary_context(trip_id: str, supabase: Client) -> str:
    days_raw = (
        supabase.table("itinerary_days").select("*").eq("trip_id", trip_id).execute().data
    )
    goals_raw = (
        supabase.table("trip_goals").select("*").eq("trip_id", trip_id).execute().data
    )
    constraints_raw = (
        supabase.table("trip_constraints").select("*").eq("trip_id", trip_id).execute().data
    )

    days_sorted = sorted(days_raw, key=lambda d: d.get("position", 0))
    days_text = "\n".join(
        f"  Day {d.get('position', '?')}: {d.get('date', '?')} — {d.get('city', 'Unknown')}"
        for d in days_sorted
    ) or "  (none)"

    goals_text = ", ".join(g["label"] for g in goals_raw) or "None set"
    constraints_text = "\n".join(
        f"  - {c['constraint_type']}: {c['description']}"
        for c in constraints_raw
    ) or "  None set"

    return (
        f"Current itinerary ({len(days_raw)} days):\n{days_text}\n\n"
        f"Trip goals: {goals_text}\n\n"
        f"Trip constraints:\n{constraints_text}"
    )


def _build_advisor_prompt(context: str, mutation_type: str, mutation_description: str) -> str:
    return (
        f"{context}\n\n"
        f"Change type: {mutation_type}\n"
        f"Proposed change: {mutation_description}\n\n"
        "Evaluate this change."
    )


def _generate_remove_suggestions(
    trip_id: str,
    day_id: str,
    day_activities: list[str],
    supabase: Client,
) -> list[ResolveSuggestion]:
    """Generate concrete move-activity suggestions when a removal violates a must_visit constraint."""
    constraints_raw = (
        supabase.table("trip_constraints").select("*").eq("trip_id", trip_id).execute().data
    )
    must_visit_descriptions = {
        c["description"]
        for c in constraints_raw
        if c["constraint_type"] == "must_visit"
    }
    matched_titles = {t for t in day_activities if t in must_visit_descriptions}
    if not matched_titles:
        return []

    acts_raw = (
        supabase.table("itinerary_activities")
        .select("*")
        .in_("day_id", [day_id])
        .execute()
        .data
    )
    matched_acts = [a for a in acts_raw if a["title"] in matched_titles]
    if not matched_acts:
        return []

    days_raw = (
        supabase.table("itinerary_days").select("*").eq("trip_id", trip_id).execute().data
    )
    target_pos = next((d.get("position", 0) for d in days_raw if d["id"] == day_id), 0)
    remaining = sorted(
        [d for d in days_raw if d["id"] != day_id],
        key=lambda d: abs(d.get("position", 0) - target_pos),
    )
    adjacent = remaining[:2]

    suggestions: list[ResolveSuggestion] = []
    for i, act in enumerate(matched_acts):
        for adj_day in adjacent:
            label = adj_day.get("city") or f"Day {adj_day.get('position', '?')}"
            suggestions.append(
                ResolveSuggestion(
                    suggestion_id=f"s-{i}-{adj_day['id']}",
                    label=f"Move '{act['title']}' to {label}",
                    description=f"Relocate this must-visit activity to {label}.",
                    payload={
                        "action": "move_activity",
                        "activity_id": act["id"],
                        "from_day_id": day_id,
                        "to_day_id": adj_day["id"],
                    },
                )
            )
    return suggestions


@router.post("/trips/{trip_id}/itinerary/validate", response_model=ValidationResult)
def validate_itinerary_mutation(
    trip_id: str,
    body: ValidateRequest,
    supabase: Client = Depends(get_supabase),
    claude: anthropic.Anthropic = Depends(get_anthropic),
    _auth: None = Depends(require_admin_key),
) -> ValidationResult:
    _get_trip_or_404(trip_id, supabase)

    context = _build_itinerary_context(trip_id, supabase)
    user_message = _build_advisor_prompt(context, body.mutation_type, body.mutation_description)

    try:
        response = claude.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=256,
            system=VALIDATE_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_message}],
        )
    except anthropic.APIStatusError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    raw_text = response.content[0].text.strip()
    if raw_text.startswith("```"):
        raw_text = re.sub(r"^```(?:json)?\s*\n?", "", raw_text)
        raw_text = re.sub(r"\n?```\s*$", "", raw_text).strip()

    try:
        data = json.loads(raw_text)
    except json.JSONDecodeError:
        raise HTTPException(status_code=502, detail="AI returned malformed JSON.")

    try:
        result = ValidationResult(**data)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"AI response failed validation: {exc}") from exc

    suggestions: list[ResolveSuggestion] = []
    if (
        result.status == "violation"
        and body.day_id
        and body.day_activities
    ):
        suggestions = _generate_remove_suggestions(
            trip_id, body.day_id, body.day_activities, supabase
        )

    return ValidationResult(status=result.status, message=result.message, suggestions=suggestions)


# ── Remove day (delete + re-index + mutation log) ─────────────────────────────

@router.delete("/trips/{trip_id}/itinerary/days/{day_id}", status_code=204)
def remove_itinerary_day(
    trip_id: str,
    day_id: str,
    supabase: Client = Depends(get_supabase),
    _auth: None = Depends(require_admin_key),
) -> Response:
    _get_trip_or_404(trip_id, supabase)

    day_result = (
        supabase.table("itinerary_days")
        .select("*")
        .eq("id", day_id)
        .eq("trip_id", trip_id)
        .execute()
    )
    if not day_result.data:
        raise HTTPException(status_code=404, detail=f"Day {day_id} not found")
    day_data = day_result.data[0]
    deleted_position: int = day_data["position"]

    supabase.table("itinerary_mutations").insert(
        {
            "trip_id": trip_id,
            "mutation_type": "remove_day",
            "payload_before": day_data,
            "payload_after": None,
        }
    ).execute()

    supabase.table("itinerary_days").delete().eq("id", day_id).eq("trip_id", trip_id).execute()

    higher = (
        supabase.table("itinerary_days")
        .select("*")
        .eq("trip_id", trip_id)
        .gt("position", deleted_position)
        .execute()
    )
    if higher.data:
        shifted = sorted(
            [{**row, "position": row["position"] - 1} for row in higher.data],
            key=lambda r: r["position"],
        )
        supabase.table("itinerary_days").upsert(shifted).execute()

    return Response(status_code=204)


# ── Resolve: apply a concrete suggestion payload ──────────────────────────────

@router.post("/trips/{trip_id}/itinerary/resolve", response_model=Itinerary)
def resolve_itinerary_mutation(
    trip_id: str,
    body: ResolveRequest,
    supabase: Client = Depends(get_supabase),
    _auth: None = Depends(require_admin_key),
) -> Itinerary:
    _get_trip_or_404(trip_id, supabase)

    payload = body.suggestion_payload
    action = payload.get("action")

    if action == "move_activity":
        activity_id = payload.get("activity_id")
        to_day_id = payload.get("to_day_id")
        if not activity_id or not to_day_id:
            raise HTTPException(
                status_code=422,
                detail="move_activity requires activity_id and to_day_id",
            )
        supabase.table("itinerary_activities").update(
            {"day_id": to_day_id}
        ).eq("id", activity_id).execute()
    else:
        raise HTTPException(status_code=422, detail=f"Unknown action: {action!r}")

    return _fetch_itinerary(trip_id, supabase)
