import hmac
import os

from fastapi import Header, HTTPException


async def require_admin_key(x_api_key: str | None = Header(None)) -> None:
    # Fail closed: missing or empty ADMIN_API_KEY env var blocks all writes.
    admin_key = os.getenv("ADMIN_API_KEY")
    if not admin_key or not hmac.compare_digest(x_api_key or "", admin_key):
        raise HTTPException(status_code=403, detail="Admin API key required")
