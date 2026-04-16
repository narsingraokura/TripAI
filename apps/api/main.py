import os
from typing import Literal, Optional

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

# ── Dependency ────────────────────────────────────────────────────────────────

def get_supabase() -> Client:
    url = os.getenv("SUPABASE_URL", "")
    key = os.getenv("SUPABASE_KEY", "")
    return create_client(url, key)


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


# ── Routes ────────────────────────────────────────────────────────────────────

URGENCY_ORDER = {"fire": 0, "now": 1, "soon": 2}


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
