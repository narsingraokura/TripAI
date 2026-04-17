from rag.qdrant_factory import build_qdrant_client
from qdrant_client.models import FieldCondition, Filter, MatchValue

from .embeddings import embed_text

COLLECTION = "trip_chunks"


def retrieve(query: str, trip_id: str, top_k: int = 3) -> list[dict]:
    qdrant = build_qdrant_client()
    vector = embed_text(query)

    results = qdrant.query_points(
        collection_name=COLLECTION,
        query=vector,
        query_filter=Filter(
            must=[FieldCondition(key="trip_id", match=MatchValue(value=trip_id))]
        ),
        limit=top_k,
    ).points

    return [
        {
            "text": r.payload.get("text", ""),
            "metadata": {k: v for k, v in r.payload.items() if k != "text"},
            "score": r.score,
        }
        for r in results
    ]
