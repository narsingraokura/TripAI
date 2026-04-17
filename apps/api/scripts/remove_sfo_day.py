"""Delete the Jun 19 San Francisco departure day from the itinerary.

The trip starts Jun 20 in London; a stray Jun 19 SFO row was seeded by mistake.
Run: python scripts/remove_sfo_day.py
"""
import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

c = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

trips = c.table("trips").select("id,name").execute().data
if not trips:
    print("No trips found.")
    raise SystemExit(1)

trip_id = trips[0]["id"]
print(f"Trip: {trips[0]['name']} ({trip_id})")

result = (
    c.table("itinerary_days")
    .delete()
    .eq("trip_id", trip_id)
    .eq("date", "2026-06-19")
    .execute()
)

deleted = len(result.data) if result.data else 0
if deleted:
    print(f"Deleted {deleted} row(s) for 2026-06-19 (San Francisco).")
else:
    print("No row found for 2026-06-19 — nothing to delete.")
