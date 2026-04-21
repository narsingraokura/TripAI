"""
Live chat test: send a simple itinerary question and verify the response
does NOT volunteer booking status, discount codes, or card tips.
"""
import json
import os
import sys

import httpx
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

BASE_URL = "http://localhost:8000"
QUESTION = "What are we doing in Paris?"

FORBIDDEN_PHRASES = [
    "discount code",
    "SC196337864",
    "booked",
    "pending",
    "amex",
    "venture x",
    "card tip",
    "credit card",
    "amex gold",
    "3x mr",
    "2x mr",
    "no fx fee",
]


def get_trip_id() -> str:
    c = create_client(os.getenv("SUPABASE_URL", ""), os.getenv("SUPABASE_KEY", ""))
    trips = c.table("trips").select("id,name").execute().data
    if not trips:
        print("ERROR: No trips found in database", file=sys.stderr)
        sys.exit(1)
    trip = trips[0]
    print(f"Using trip: {trip['name']} ({trip['id']})")
    return trip["id"]


def run_test(trip_id: str) -> None:
    url = f"{BASE_URL}/trips/{trip_id}/chat"
    payload = {"query": QUESTION}

    print(f"\nQuestion: {QUESTION!r}")
    print("-" * 60)

    full_response = []
    with httpx.stream("POST", url, json=payload, timeout=30) as r:
        if r.status_code != 200:
            print(f"ERROR: HTTP {r.status_code}")
            print(r.text)
            sys.exit(1)
        for line in r.iter_lines():
            if not line.startswith("data:"):
                continue
            raw = line[len("data:"):].strip()
            if raw == "[DONE]":
                break
            try:
                event = json.loads(raw)
            except json.JSONDecodeError:
                continue
            if event.get("type") == "token":
                token = event["content"]
                full_response.append(token)
                print(token, end="", flush=True)

    print("\n" + "-" * 60)
    response_text = "".join(full_response).lower()

    violations = [p for p in FORBIDDEN_PHRASES if p.lower() in response_text]

    if violations:
        print(f"\nFAIL — response volunteered unsolicited info: {violations}")
        sys.exit(1)
    else:
        print("\nPASS — response contains no unsolicited booking/payment info")


if __name__ == "__main__":
    trip_id = get_trip_id()
    run_test(trip_id)
