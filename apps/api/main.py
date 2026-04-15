import os
from typing import Optional

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
