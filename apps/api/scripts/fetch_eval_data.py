"""Fetch real Supabase data for eval golden dataset generation."""
import json
import os
import sys

from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

url = os.getenv("SUPABASE_URL", "")
key = os.getenv("SUPABASE_KEY", "")
client = create_client(url, key)

trip_res = client.table("trips").select("*").limit(1).execute()
trip = trip_res.data[0]
trip_id = trip["id"]

print("=== TRIP ===")
print(json.dumps(trip, indent=2, default=str))

bookings_res = (
    client.table("bookings")
    .select("*")
    .eq("trip_id", trip_id)
    .execute()
)
print("\n=== BOOKINGS ===")
print(json.dumps(bookings_res.data, indent=2, default=str))

days_res = (
    client.table("itinerary_days")
    .select("id, date, city, country, title, plan, intensity, is_special, special_label")
    .eq("trip_id", trip_id)
    .order("date")
    .execute()
)
print("\n=== ITINERARY DAYS ===")
print(json.dumps(days_res.data, indent=2, default=str))
