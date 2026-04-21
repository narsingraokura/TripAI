import os

from fastapi import Header, HTTPException


async def require_admin_key(x_api_key: str = Header(None)) -> None:
    """
    FastAPI dependency that validates the X-API-Key header.

    Fail closed: if ADMIN_API_KEY env var is unset or empty, all writes are blocked.
    """
    admin_key = os.getenv("ADMIN_API_KEY")
    if not admin_key or x_api_key != admin_key:
        raise HTTPException(status_code=403, detail="Admin API key required")
