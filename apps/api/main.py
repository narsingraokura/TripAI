import json
import os
from typing import Literal, Optional

import anthropic
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import Client, create_client

load_dotenv()

app = FastAPI(title="TripAI API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Dependencies ─────────────────────────────────────────────────────────────

def get_supabase() -> Client:
    url = os.getenv("SUPABASE_URL", "")
    key = os.getenv("SUPABASE_KEY", "")
    return create_client(url, key)


def get_anthropic() -> anthropic.Anthropic:
    return anthropic.Anthropic()


# ── Pydantic models ───────────────────────────────────────────────────────────

class Booking(BaseModel):
    id: str
    title: str
    subtitle: str
    category: str
    urgency: str
    status: str
    estimated_cost: float
    actual_cost: Optional[float]
    deadline: str
    discount_code: Optional[str]
    card_tip: str
    booked_at: Optional[str]


class ItineraryDay(BaseModel):
    id: str
    trip_id: str
    date: str
    city: str
    country: str
    title: str
    plan: str
    intensity: Literal["light", "moderate", "busy", "travel", "special"]
    is_special: bool
    special_label: Optional[str]


class ItineraryDayUpdate(BaseModel):
    title: Optional[str] = None
    plan: Optional[str] = None
    intensity: Optional[Literal["light", "moderate", "busy", "travel", "special"]] = None


class ItineraryResponse(BaseModel):
    days: list[ItineraryDay]


class Suggestion(BaseModel):
    title: str
    description: str
    why_fits: str
    cost_delta: int
    intensity: Literal["light", "moderate", "busy"]
    booking_required: bool


class SuggestResponse(BaseModel):
    date: str
    city: str
    suggestions: list[Suggestion]


class BookingStatusUpdate(BaseModel):
    status: str


class BookingSummary(BaseModel):
    total_estimated: float
    total_actual: float
    locked_in: float
    remaining: float
    booked_count: int
    total_count: int


class BookingsResponse(BaseModel):
    bookings: list[Booking]
    summary: BookingSummary


# ── Constants ────────────────────────────────────────────────────────────────

URGENCY_ORDER = {"fire": 0, "now": 1, "soon": 2}

BUDGET_CAP = 25_000

SUGGEST_SYSTEM_PROMPT = """\
You are a travel activity advisor for the Kura family Europe 2026 trip.

Family profile:
- 4 travelers: 2 adults (Indian passports, US H-1B visa), 2 children ages 9 and 11 (US passports)
- Diet: Hindu non-vegetarian — no beef, no pork
- Total trip budget cap: $25,000 USD

Instructions:
- Suggest exactly 3 alternative activities for the given day
- Respond ONLY with a JSON array of exactly 3 objects — no prose, no markdown fences, no explanation
- Each object must have exactly these fields:
  - "title" (string): Short alternative activity name
  - "description" (string): 1-2 sentences on what the family would do
  - "why_fits" (string): Why this works for these specific travelers (kids, diet, budget, visas)
  - "cost_delta" (integer): Cost difference in USD vs the current activity (+more expensive, −cheaper, 0=same)
  - "intensity" (string): Exactly one of "light", "moderate", "busy"
  - "booking_required" (boolean): Whether advance booking is needed
- Include at least one cheaper option (negative cost_delta) and at least one similar-cost option (cost_delta within ±50 USD)
"""


# ── Routes ────────────────────────────────────────────────────────────────────


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/trips/{trip_id}/bookings", response_model=BookingsResponse)
def get_bookings(trip_id: str, supabase: Client = Depends(get_supabase)) -> BookingsResponse:
    trip_result = supabase.table("trips").select("id").eq("id", trip_id).execute()
    if not trip_result.data:
        raise HTTPException(status_code=404, detail=f"Trip {trip_id} not found")

    bookings_result = supabase.table("bookings").select("*").eq("trip_id", trip_id).execute()
    raw = bookings_result.data

    raw.sort(key=lambda b: URGENCY_ORDER.get(b["urgency"], 99))

    bookings = [Booking(**b) for b in raw]

    total_estimated = sum(b.estimated_cost for b in bookings)
    total_actual = sum(b.actual_cost for b in bookings if b.actual_cost is not None)
    locked_in = sum(
        (b.actual_cost if b.actual_cost is not None else b.estimated_cost)
        for b in bookings
        if b.status == "booked"
    )
    remaining = total_estimated - locked_in

    summary = BookingSummary(
        total_estimated=round(total_estimated, 2),
        total_actual=round(total_actual, 2),
        locked_in=round(locked_in, 2),
        remaining=round(remaining, 2),
        booked_count=sum(1 for b in bookings if b.status == "booked"),
        total_count=len(bookings),
    )

    return BookingsResponse(bookings=bookings, summary=summary)


@app.patch("/trips/{trip_id}/bookings/{booking_id}", response_model=Booking)
def patch_booking(
    trip_id: str,
    booking_id: str,
    update: BookingStatusUpdate,
    supabase: Client = Depends(get_supabase),
) -> Booking:
    trip_result = supabase.table("trips").select("id").eq("id", trip_id).execute()
    if not trip_result.data:
        raise HTTPException(status_code=404, detail=f"Trip {trip_id} not found")

    booking_result = (
        supabase.table("bookings")
        .select("*")
        .eq("id", booking_id)
        .eq("trip_id", trip_id)
        .execute()
    )
    if not booking_result.data:
        raise HTTPException(status_code=404, detail=f"Booking {booking_id} not found")

    update_result = (
        supabase.table("bookings")
        .update({"status": update.status})
        .eq("id", booking_id)
        .eq("trip_id", trip_id)
        .execute()
    )
    return Booking(**update_result.data[0])


@app.get("/trips/{trip_id}/itinerary", response_model=ItineraryResponse)
def get_itinerary(trip_id: str, supabase: Client = Depends(get_supabase)) -> ItineraryResponse:
    trip_result = supabase.table("trips").select("id").eq("id", trip_id).execute()
    if not trip_result.data:
        raise HTTPException(status_code=404, detail=f"Trip {trip_id} not found")

    result = supabase.table("itinerary_days").select("*").eq("trip_id", trip_id).execute()
    days = sorted([ItineraryDay(**d) for d in result.data], key=lambda d: d.date)
    return ItineraryResponse(days=days)


@app.get("/trips/{trip_id}/itinerary/{date}", response_model=ItineraryDay)
def get_itinerary_day(trip_id: str, date: str, supabase: Client = Depends(get_supabase)) -> ItineraryDay:
    trip_result = supabase.table("trips").select("id").eq("id", trip_id).execute()
    if not trip_result.data:
        raise HTTPException(status_code=404, detail=f"Trip {trip_id} not found")

    result = (
        supabase.table("itinerary_days")
        .select("*")
        .eq("date", date)
        .eq("trip_id", trip_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail=f"No itinerary day found for {date}")

    return ItineraryDay(**result.data[0])


@app.patch("/trips/{trip_id}/itinerary/{date}", response_model=ItineraryDay)
def patch_itinerary_day(
    trip_id: str,
    date: str,
    update: ItineraryDayUpdate,
    supabase: Client = Depends(get_supabase),
) -> ItineraryDay:
    trip_result = supabase.table("trips").select("id").eq("id", trip_id).execute()
    if not trip_result.data:
        raise HTTPException(status_code=404, detail=f"Trip {trip_id} not found")

    existing = (
        supabase.table("itinerary_days")
        .select("*")
        .eq("date", date)
        .eq("trip_id", trip_id)
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail=f"No itinerary day found for {date}")

    fields = update.model_dump(exclude_none=True)
    updated = (
        supabase.table("itinerary_days")
        .update(fields)
        .eq("date", date)
        .eq("trip_id", trip_id)
        .execute()
    )
    return ItineraryDay(**updated.data[0])


@app.post("/trips/{trip_id}/itinerary/{date}/suggest", response_model=SuggestResponse)
def suggest_itinerary_alternatives(
    trip_id: str,
    date: str,
    supabase: Client = Depends(get_supabase),
    claude: anthropic.Anthropic = Depends(get_anthropic),
) -> SuggestResponse:
    trip_result = supabase.table("trips").select("id").eq("id", trip_id).execute()
    if not trip_result.data:
        raise HTTPException(status_code=404, detail=f"Trip {trip_id} not found")

    day_result = (
        supabase.table("itinerary_days")
        .select("*")
        .eq("date", date)
        .eq("trip_id", trip_id)
        .execute()
    )
    if not day_result.data:
        raise HTTPException(status_code=404, detail=f"No itinerary day found for {date}")

    day = day_result.data[0]

    bookings_result = supabase.table("bookings").select("*").eq("trip_id", trip_id).execute()
    locked_in = sum(
        (b["actual_cost"] if b["actual_cost"] is not None else b["estimated_cost"])
        for b in bookings_result.data
        if b["status"] == "booked"
    )
    budget_remaining = BUDGET_CAP - locked_in

    user_message = (
        f"Date: {date}\n"
        f"City: {day['city']}, {day['country']}\n"
        f"Current plan: {day['title']}. {day['plan']}\n"
        f"Current intensity: {day['intensity']}\n"
        f"Budget locked in so far: ${locked_in:,.0f} of ${BUDGET_CAP:,} "
        f"(remaining: ${budget_remaining:,.0f})\n\n"
        "Suggest 3 alternative activities for this day."
    )

    response = claude.messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=1500,
        temperature=0.7,
        system=SUGGEST_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}],
    )

    raw_text = response.content[0].text

    try:
        suggestions_data = json.loads(raw_text)
    except json.JSONDecodeError:
        raise HTTPException(status_code=502, detail="AI returned malformed JSON. Please try again.")

    if not isinstance(suggestions_data, list) or len(suggestions_data) != 3:
        count = len(suggestions_data) if isinstance(suggestions_data, list) else "non-list"
        raise HTTPException(
            status_code=502,
            detail=f"AI returned {count} suggestions, expected exactly 3.",
        )

    try:
        suggestions = [Suggestion(**s) for s in suggestions_data]
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"AI response failed validation: {exc}") from exc

    return SuggestResponse(date=date, city=day["city"], suggestions=suggestions)
