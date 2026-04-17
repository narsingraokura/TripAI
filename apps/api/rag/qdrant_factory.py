"""
Builds a Qdrant client that works for both local Docker and Qdrant Cloud.

Local dev (no auth):
    QDRANT_URL=http://localhost:6333
    QDRANT_API_KEY=   (empty or unset)

Qdrant Cloud (with auth):
    QDRANT_URL=https://xxx.aws.cloud.qdrant.io:6333
    QDRANT_API_KEY=<your-key>

Funnelling all client construction through here means future connection
changes happen in one place, not scattered across every module that uses Qdrant.
"""

import os
from qdrant_client import QdrantClient


def build_qdrant_client() -> QdrantClient:
    """Return a QdrantClient configured from environment variables."""
    url = os.getenv("QDRANT_URL")
    api_key = os.getenv("QDRANT_API_KEY") or None  # empty string → None

    if url:
        return QdrantClient(url=url, api_key=api_key)

    # Legacy fallback — keeps older .env files working.
    return QdrantClient(
        host=os.getenv("QDRANT_HOST", "localhost"),
        port=int(os.getenv("QDRANT_PORT", "6333")),
    )
