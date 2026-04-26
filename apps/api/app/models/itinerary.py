from typing import Literal, Optional

from pydantic import BaseModel


# ── Request models ────────────────────────────────────────────────────────────

class GoalCreate(BaseModel):
    goal_type: Literal["preset", "custom"]
    label: str


class GoalListUpdate(BaseModel):
    goals: list[GoalCreate]


class ConstraintCreate(BaseModel):
    constraint_type: Literal[
        "must_visit", "must_avoid", "budget_cap", "time_constraint", "custom"
    ]
    description: str
    value: Optional[float] = None


class DayCreate(BaseModel):
    position: int
    date: Optional[str] = None
    city: Optional[str] = None
    day_type: Literal["exploration", "rest", "transit"] = "exploration"
    notes: Optional[str] = None


class DayUpdate(BaseModel):
    position: Optional[int] = None
    date: Optional[str] = None
    city: Optional[str] = None
    day_type: Optional[Literal["exploration", "rest", "transit"]] = None
    notes: Optional[str] = None


class ActivityCreate(BaseModel):
    position: int
    title: str
    time_slot: Literal["morning", "afternoon", "evening", "specific"]
    specific_time: Optional[str] = None
    category: Literal[
        "food", "transit", "sightseeing", "lodging", "shopping", "activity"
    ]
    estimated_cost: Optional[float] = None
    notes: Optional[str] = None


class ReorderRequest(BaseModel):
    ordered_ids: list[str]


# ── Response models ───────────────────────────────────────────────────────────

class Goal(BaseModel):
    id: str
    trip_id: str
    goal_type: Literal["preset", "custom"]
    label: str
    created_at: str


class Constraint(BaseModel):
    id: str
    trip_id: str
    constraint_type: Literal[
        "must_visit", "must_avoid", "budget_cap", "time_constraint", "custom"
    ]
    description: str
    value: Optional[float]
    created_at: str


class Activity(BaseModel):
    id: str
    day_id: str
    position: int
    title: str
    time_slot: Literal["morning", "afternoon", "evening", "specific"]
    specific_time: Optional[str]
    category: Literal[
        "food", "transit", "sightseeing", "lodging", "shopping", "activity"
    ]
    estimated_cost: Optional[float]
    notes: Optional[str]
    created_at: str


class Day(BaseModel):
    id: str
    trip_id: str
    position: int
    date: Optional[str]
    city: Optional[str]
    day_type: Literal["exploration", "rest", "transit"]
    notes: Optional[str]
    created_at: str
    updated_at: str
    activities: list[Activity] = []


class Itinerary(BaseModel):
    days: list[Day]
    goals: list[Goal]
    constraints: list[Constraint]


class ValidateRequest(BaseModel):
    mutation_type: str
    mutation_description: str


class ValidationResult(BaseModel):
    status: Literal["ok", "warning", "violation"]
    message: str
