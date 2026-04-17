import os
import uuid

from rag.qdrant_factory import build_qdrant_client
from qdrant_client.models import (
    Distance,
    FieldCondition,
    Filter,
    MatchValue,
    PayloadSchemaType,
    PointStruct,
    VectorParams,
)
from supabase import create_client

from .embeddings import embed_text

COLLECTION = "trip_chunks"
VECTOR_SIZE = 1536
MAX_CHUNK_CHARS = 2000
OVERLAP_CHARS = 200


def _point_id(source_id: str, chunk_index: int) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"{source_id}:{chunk_index}"))


def _split_text(text: str) -> list[str]:
    if len(text) <= MAX_CHUNK_CHARS:
        return [text]
    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = start + MAX_CHUNK_CHARS
        chunks.append(text[start:end])
        if end >= len(text):
            break
        start = end - OVERLAP_CHARS
    return chunks


def _chunk_itinerary_day(day: dict) -> list[tuple[str, dict]]:
    plan = day.get("plan") or ""
    combined = f"{day['title']}. {plan}".strip(". ").strip()
    if not combined:
        return []

    parts = _split_text(combined)
    chunks: list[tuple[str, dict]] = []

    for i, part in enumerate(parts):
        lines = [
            f"Date: {day['date']}",
            f"City: {day['city']}, {day['country']}",
            f"Intensity: {day['intensity']}",
        ]
        if day.get("is_special") and day.get("special_label"):
            lines.append(f"Special: {day['special_label']}")
        lines.append(f"Plan: {part}")

        metadata: dict = {
            "trip_id": day["trip_id"],
            "source_type": "itinerary",
            "source_id": day["id"],
            "date": day["date"],
            "city": day["city"],
            "country": day["country"],
            "chunk_index": i,
            "chunk_total": len(parts),
        }
        chunks.append(("\n".join(lines), metadata))

    return chunks


def _chunk_booking(booking: dict, trip_id: str) -> tuple[str, dict]:
    lines = [
        f"Booking: {booking['title']}",
        f"Category: {booking['category']} | Urgency: {booking['urgency']} | Status: {booking['status']}",
        f"Estimated cost: ${booking['estimated_cost']}",
        f"Deadline: {booking['deadline']}",
    ]
    if booking.get("discount_code"):
        lines.append(f"Discount code: {booking['discount_code']}")
    if booking.get("card_tip"):
        lines.append(f"Card tip: {booking['card_tip']}")
    if booking.get("notes"):
        lines.append(f"Notes: {booking['notes']}")

    metadata: dict = {
        "trip_id": trip_id,
        "source_type": "booking",
        "source_id": booking["id"],
        "date": None,
        "city": None,
        "country": None,
        "chunk_index": 0,
        "chunk_total": 1,
    }
    return "\n".join(lines), metadata


def index_trip(trip_id: str) -> int:
    supabase = create_client(
        os.getenv("SUPABASE_URL", ""), os.getenv("SUPABASE_KEY", "")
    )
    qdrant = build_qdrant_client()

    existing_names = [c.name for c in qdrant.get_collections().collections]
    if COLLECTION not in existing_names:
        qdrant.create_collection(
            collection_name=COLLECTION,
            vectors_config=VectorParams(size=VECTOR_SIZE, distance=Distance.COSINE),
        )
        qdrant.create_payload_index(
            collection_name=COLLECTION,
            field_name="trip_id",
            field_schema=PayloadSchemaType.KEYWORD,
        )

    qdrant.delete(
        collection_name=COLLECTION,
        points_selector=Filter(
            must=[FieldCondition(key="trip_id", match=MatchValue(value=trip_id))]
        ),
    )

    days = (
        supabase.table("itinerary_days")
        .select("*")
        .eq("trip_id", trip_id)
        .execute()
        .data
    )
    bookings = (
        supabase.table("bookings")
        .select("*")
        .eq("trip_id", trip_id)
        .execute()
        .data
    )

    all_chunks: list[tuple[str, dict]] = []
    for day in days:
        all_chunks.extend(_chunk_itinerary_day(day))
    for booking in bookings:
        chunk_text, metadata = _chunk_booking(booking, trip_id)
        all_chunks.append((chunk_text, metadata))

    if not all_chunks:
        return 0

    points: list[PointStruct] = []
    for text, metadata in all_chunks:
        vector = embed_text(text)
        point_id = _point_id(metadata["source_id"], metadata["chunk_index"])
        points.append(
            PointStruct(id=point_id, vector=vector, payload={**metadata, "text": text})
        )

    qdrant.upsert(collection_name=COLLECTION, points=points)
    return len(points)
