from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from main import app, get_supabase

client = TestClient(app)

TRIP_ID = "550e8400-e29b-41d4-a716-446655440000"
NONEXISTENT_TRIP_ID = "00000000-0000-0000-0000-000000000000"
FAKE_VECTOR = [0.1] * 1536


# ── embeddings ────────────────────────────────────────────────────────────────


def test_embed_text_returns_floats():
    from rag.embeddings import embed_text

    mock_client = MagicMock()
    mock_client.embeddings.create.return_value.data = [MagicMock(embedding=FAKE_VECTOR)]
    with patch("rag.embeddings.OpenAI", return_value=mock_client):
        result = embed_text("test text")
    assert result == FAKE_VECTOR


def test_embed_text_uses_correct_model():
    from rag.embeddings import embed_text

    mock_client = MagicMock()
    mock_client.embeddings.create.return_value.data = [MagicMock(embedding=FAKE_VECTOR)]
    with patch("rag.embeddings.OpenAI", return_value=mock_client):
        embed_text("test text")
    call_kwargs = mock_client.embeddings.create.call_args.kwargs
    assert call_kwargs["model"] == "text-embedding-3-small"


# ── chunking helpers ──────────────────────────────────────────────────────────


def test_split_text_short_returns_single_chunk():
    from rag.indexer import _split_text

    text = "short text"
    assert _split_text(text) == [text]


def test_split_text_long_returns_multiple_chunks():
    from rag.indexer import MAX_CHUNK_CHARS, _split_text

    text = "a" * (MAX_CHUNK_CHARS + 500)
    chunks = _split_text(text)
    assert len(chunks) > 1


def test_split_text_overlap():
    from rag.indexer import MAX_CHUNK_CHARS, OVERLAP_CHARS, _split_text

    text = "a" * (MAX_CHUNK_CHARS + 100)
    chunks = _split_text(text)
    assert len(chunks) == 2
    assert chunks[1] == text[MAX_CHUNK_CHARS - OVERLAP_CHARS :]


# ── itinerary day chunking ────────────────────────────────────────────────────

_BASE_DAY: dict = {
    "id": "day-1",
    "trip_id": TRIP_ID,
    "date": "2026-06-20",
    "city": "London",
    "country": "UK",
    "title": "Arrive London",
    "plan": "Land at LHR, check in, jet lag buffer",
    "intensity": "light",
    "is_special": False,
    "special_label": None,
}


def test_chunk_itinerary_day_short_plan_is_single_chunk():
    from rag.indexer import _chunk_itinerary_day

    chunks = _chunk_itinerary_day(_BASE_DAY)
    assert len(chunks) == 1
    text, metadata = chunks[0]
    assert "2026-06-20" in text
    assert "London" in text
    assert "LHR" in text
    assert metadata["trip_id"] == TRIP_ID
    assert metadata["source_type"] == "itinerary"
    assert metadata["chunk_index"] == 0
    assert metadata["chunk_total"] == 1


def test_chunk_itinerary_day_long_plan_splits():
    from rag.indexer import MAX_CHUNK_CHARS, _chunk_itinerary_day

    day = {**_BASE_DAY, "plan": "x" * (MAX_CHUNK_CHARS + 500)}
    chunks = _chunk_itinerary_day(day)
    assert len(chunks) > 1
    assert all(m["chunk_total"] == len(chunks) for _, m in chunks)


def test_chunk_itinerary_day_empty_plan_returns_empty():
    from rag.indexer import _chunk_itinerary_day

    day = {**_BASE_DAY, "title": "", "plan": ""}
    assert _chunk_itinerary_day(day) == []


def test_chunk_itinerary_day_special_label_included():
    from rag.indexer import _chunk_itinerary_day

    day = {
        **_BASE_DAY,
        "date": "2026-06-26",
        "city": "Paris",
        "country": "France",
        "title": "Anniversary",
        "plan": "Dinner at Septime",
        "intensity": "special",
        "is_special": True,
        "special_label": "Wedding Anniversary",
    }
    text, _ = _chunk_itinerary_day(day)[0]
    assert "Wedding Anniversary" in text


# ── booking chunking ──────────────────────────────────────────────────────────

_BASE_BOOKING: dict = {
    "id": "b1",
    "title": "Flights SFO→LHR",
    "subtitle": "4 seats",
    "category": "flights",
    "urgency": "fire",
    "status": "pending",
    "estimated_cost": 4800.0,
    "actual_cost": None,
    "deadline": "This week",
    "discount_code": None,
    "card_tip": "Amex Gold 3X MR",
    "notes": None,
}


def test_chunk_booking_format():
    from rag.indexer import _chunk_booking

    text, metadata = _chunk_booking(_BASE_BOOKING, TRIP_ID)
    assert "Flights SFO→LHR" in text
    assert "flights" in text
    assert "4800" in text
    assert metadata["trip_id"] == TRIP_ID
    assert metadata["source_type"] == "booking"
    assert metadata["source_id"] == "b1"
    assert metadata["chunk_index"] == 0


def test_chunk_booking_discount_code_included():
    from rag.indexer import _chunk_booking

    booking = {**_BASE_BOOKING, "id": "b5", "title": "Crowne Plaza", "discount_code": "100270748"}
    text, _ = _chunk_booking(booking, TRIP_ID)
    assert "100270748" in text


# ── indexer ───────────────────────────────────────────────────────────────────

_MOCK_DAYS = [_BASE_DAY]
_MOCK_BOOKINGS = [{**_BASE_BOOKING, "trip_id": TRIP_ID}]


def _make_supabase_mock(days=_MOCK_DAYS, bookings=_MOCK_BOOKINGS) -> MagicMock:
    mock = MagicMock()
    days_resp = MagicMock()
    days_resp.data = days
    bookings_resp = MagicMock()
    bookings_resp.data = bookings
    mock.table.return_value.select.return_value.eq.return_value.execute.side_effect = [
        days_resp,
        bookings_resp,
    ]
    return mock


def _make_qdrant_mock(collection_exists: bool = False) -> MagicMock:
    mock = MagicMock()
    if collection_exists:
        existing = MagicMock()
        existing.name = "trip_chunks"
        mock.get_collections.return_value.collections = [existing]
    else:
        mock.get_collections.return_value.collections = []
    return mock


def test_index_trip_creates_collection_when_missing():
    from rag.indexer import index_trip

    mock_qdrant = _make_qdrant_mock(collection_exists=False)
    with (
        patch("rag.indexer.create_client", return_value=_make_supabase_mock()),
        patch("rag.qdrant_factory.QdrantClient", return_value=mock_qdrant),
        patch("rag.indexer.embed_text", return_value=FAKE_VECTOR),
    ):
        index_trip(TRIP_ID)

    mock_qdrant.create_collection.assert_called_once()


def test_index_trip_skips_create_when_collection_exists():
    from rag.indexer import index_trip

    mock_qdrant = _make_qdrant_mock(collection_exists=True)
    with (
        patch("rag.indexer.create_client", return_value=_make_supabase_mock()),
        patch("rag.qdrant_factory.QdrantClient", return_value=mock_qdrant),
        patch("rag.indexer.embed_text", return_value=FAKE_VECTOR),
    ):
        index_trip(TRIP_ID)

    mock_qdrant.create_collection.assert_not_called()


def test_index_trip_deletes_existing_before_upsert():
    from rag.indexer import index_trip

    mock_qdrant = _make_qdrant_mock()
    with (
        patch("rag.indexer.create_client", return_value=_make_supabase_mock()),
        patch("rag.qdrant_factory.QdrantClient", return_value=mock_qdrant),
        patch("rag.indexer.embed_text", return_value=FAKE_VECTOR),
    ):
        index_trip(TRIP_ID)

    mock_qdrant.delete.assert_called_once()


def test_index_trip_upserts_correct_point_count():
    from rag.indexer import index_trip

    mock_qdrant = _make_qdrant_mock()
    with (
        patch("rag.indexer.create_client", return_value=_make_supabase_mock()),
        patch("rag.qdrant_factory.QdrantClient", return_value=mock_qdrant),
        patch("rag.indexer.embed_text", return_value=FAKE_VECTOR),
    ):
        count = index_trip(TRIP_ID)

    assert count == 2  # 1 day + 1 booking
    points = mock_qdrant.upsert.call_args.kwargs["points"]
    assert len(points) == 2


def test_index_trip_all_points_have_trip_id():
    from rag.indexer import index_trip

    mock_qdrant = _make_qdrant_mock()
    with (
        patch("rag.indexer.create_client", return_value=_make_supabase_mock()),
        patch("rag.qdrant_factory.QdrantClient", return_value=mock_qdrant),
        patch("rag.indexer.embed_text", return_value=FAKE_VECTOR),
    ):
        index_trip(TRIP_ID)

    points = mock_qdrant.upsert.call_args.kwargs["points"]
    assert all(p.payload["trip_id"] == TRIP_ID for p in points)


def test_index_trip_returns_zero_and_skips_upsert_for_empty_trip():
    from rag.indexer import index_trip

    mock_qdrant = _make_qdrant_mock()
    with (
        patch("rag.indexer.create_client", return_value=_make_supabase_mock(days=[], bookings=[])),
        patch("rag.qdrant_factory.QdrantClient", return_value=mock_qdrant),
        patch("rag.indexer.embed_text", return_value=FAKE_VECTOR),
    ):
        count = index_trip(TRIP_ID)

    assert count == 0
    mock_qdrant.upsert.assert_not_called()


# ── retriever ─────────────────────────────────────────────────────────────────


def _make_search_result(text: str, score: float) -> MagicMock:
    r = MagicMock()
    r.payload = {
        "text": text,
        "trip_id": TRIP_ID,
        "source_type": "itinerary",
        "source_id": "day-1",
        "date": "2026-06-20",
        "city": "London",
        "country": "UK",
        "chunk_index": 0,
        "chunk_total": 1,
    }
    r.score = score
    return r


def test_retrieve_applies_trip_id_filter():
    from rag.retriever import retrieve

    mock_qdrant = MagicMock()
    mock_qdrant.query_points.return_value.points = []
    with (
        patch("rag.qdrant_factory.QdrantClient", return_value=mock_qdrant),
        patch("rag.retriever.embed_text", return_value=FAKE_VECTOR),
    ):
        retrieve("what hotel am I in?", TRIP_ID)

    call_kwargs = mock_qdrant.query_points.call_args.kwargs
    filt = call_kwargs["query_filter"]
    assert filt is not None
    cond = filt.must[0]
    assert cond.key == "trip_id"
    assert cond.match.value == TRIP_ID


def test_retrieve_returns_correct_shape():
    from rag.retriever import retrieve

    mock_qdrant = MagicMock()
    mock_qdrant.query_points.return_value.points = [_make_search_result("London day plan", 0.92)]
    with (
        patch("rag.qdrant_factory.QdrantClient", return_value=mock_qdrant),
        patch("rag.retriever.embed_text", return_value=FAKE_VECTOR),
    ):
        results = retrieve("hotels", TRIP_ID)

    assert len(results) == 1
    assert results[0]["text"] == "London day plan"
    assert results[0]["score"] == 0.92
    assert "trip_id" in results[0]["metadata"]


def test_retrieve_respects_top_k():
    from rag.retriever import retrieve

    mock_qdrant = MagicMock()
    mock_qdrant.query_points.return_value.points = []
    with (
        patch("rag.qdrant_factory.QdrantClient", return_value=mock_qdrant),
        patch("rag.retriever.embed_text", return_value=FAKE_VECTOR),
    ):
        retrieve("query", TRIP_ID, top_k=5)

    assert mock_qdrant.query_points.call_args.kwargs["limit"] == 5


def test_retrieve_default_top_k_is_3():
    from rag.retriever import retrieve

    mock_qdrant = MagicMock()
    mock_qdrant.query_points.return_value.points = []
    with (
        patch("rag.qdrant_factory.QdrantClient", return_value=mock_qdrant),
        patch("rag.retriever.embed_text", return_value=FAKE_VECTOR),
    ):
        retrieve("query", TRIP_ID)

    assert mock_qdrant.query_points.call_args.kwargs["limit"] == 3


# ── POST /trips/{trip_id}/chat/index ──────────────────────────────────────────


def test_chat_index_triggers_indexing():
    mock_supabase = MagicMock()
    trip_resp = MagicMock()
    trip_resp.data = [{"id": TRIP_ID}]
    mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = (
        trip_resp
    )

    with patch("main.index_trip", return_value=31) as mock_index:
        app.dependency_overrides[get_supabase] = lambda: mock_supabase
        response = client.post(f"/trips/{TRIP_ID}/chat/index", headers={"X-API-Key": "test-key-12345"})
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == {"indexed": 31}
    mock_index.assert_called_once_with(TRIP_ID)


def test_chat_index_404_for_unknown_trip():
    mock_supabase = MagicMock()
    trip_resp = MagicMock()
    trip_resp.data = []
    mock_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = (
        trip_resp
    )

    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    response = client.post(f"/trips/{NONEXISTENT_TRIP_ID}/chat/index", headers={"X-API-Key": "test-key-12345"})
    app.dependency_overrides.clear()

    assert response.status_code == 404
