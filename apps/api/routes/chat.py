import asyncio
import json
import os
import re
import time
import uuid
from typing import AsyncGenerator, Optional

import anthropic
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from supabase import Client, create_client

from rag.guardrail import classify_query
from rag.retriever import retrieve

load_dotenv()

router = APIRouter()

INJECTION_PATTERNS = [
    r"ignore\s+(previous|above|all)\s+instructions?",
    r"you\s+are\s+now",
    r"act\s+as\s+(a\s+|an\s+)?(different|new|another)",
    r"<\|",
]

CHAT_SYSTEM_PROMPT = """\
You are TripAI, a travel assistant for the Kura family's Europe 2026 trip (Jun 19–Jul 5).
4 travelers: 2 adults (Indian passports, US H-1B visa), 2 kids (US passports).
Route: London → Paris → Interlaken, Switzerland → Milan. Budget cap: $25,000.

Answer ONLY from the trip context below.
If the answer is not in the context, say exactly:
"I don't have that information in your trip data."
Never invent dates, costs, hotels, or bookings.
Be concise. Answer only what was asked.
Do not volunteer booking status, payment recommendations, discount codes, or credit card tips unless the user specifically asks for them.
Even if the context contains words like "booked", "pre-booked", "pending", "reservation required", or deadline reminders, omit them from your answer. Describe activities only — never their booking state.

--- TRIP CONTEXT ---
{context}
--- END CONTEXT ---"""


REFUSAL_MSG = (
    "I can only help with questions about your Europe 2026 trip. "
    "Feel free to ask about your destinations, bookings, dates, or travel logistics!"
)


class ChatRequest(BaseModel):
    query: str
    conversation_id: Optional[str] = None


def get_supabase() -> Client:
    url = os.getenv("SUPABASE_URL", "")
    key = os.getenv("SUPABASE_KEY", "")
    return create_client(url, key)


def get_async_anthropic() -> anthropic.AsyncAnthropic:
    return anthropic.AsyncAnthropic()


def _validate_query(query: str) -> None:
    if not query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")
    if len(query) > 500:
        raise HTTPException(status_code=400, detail="Query too long (max 500 characters)")
    for pattern in INJECTION_PATTERNS:
        if re.search(pattern, query, re.IGNORECASE):
            raise HTTPException(status_code=400, detail="Invalid query")


def _assemble_context(chunks: list[dict[str, object]]) -> str:
    if not chunks:
        return "(no matching trip data found)"
    return "\n".join(f"[{i + 1}] {chunk['text']}" for i, chunk in enumerate(chunks))


async def _refusal_event_gen(
    conversation_id: str,
    trip_id: str,
    query: str,
    supabase: Client,
) -> AsyncGenerator[str, None]:
    start = time.monotonic()
    yield f"data: {json.dumps({'type': 'token', 'content': REFUSAL_MSG})}\n\n"
    ms = int((time.monotonic() - start) * 1000)
    yield f"data: {json.dumps({'type': 'done', 'conversation_id': conversation_id, 'latency_ms': ms})}\n\n"
    yield "data: [DONE]\n\n"
    try:
        supabase.table("chat_logs").insert(
            {
                "trip_id": trip_id,
                "conversation_id": conversation_id,
                "query": query,
                "retrieved_chunks": [],
                "response": REFUSAL_MSG,
                "latency_ms": ms,
                "guardrail_classification": "off_topic",
            }
        ).execute()
    except Exception:
        pass


@router.post("/trips/{trip_id}/chat")
async def chat(
    trip_id: str,
    body: ChatRequest,
    supabase: Client = Depends(get_supabase),
    claude: anthropic.AsyncAnthropic = Depends(get_async_anthropic),
) -> StreamingResponse:
    _validate_query(body.query)

    conversation_id = body.conversation_id or str(uuid.uuid4())
    classification = await classify_query(body.query)

    trip_result = supabase.table("trips").select("id").eq("id", trip_id).execute()
    if not trip_result.data:
        raise HTTPException(status_code=404, detail=f"Trip {trip_id} not found")

    if classification == "off_topic":
        return StreamingResponse(
            _refusal_event_gen(conversation_id, trip_id, body.query, supabase),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    chunks: list[dict[str, object]] = await asyncio.to_thread(retrieve, body.query, trip_id, 3)
    context = _assemble_context(chunks)
    system = CHAT_SYSTEM_PROMPT.format(context=context)
    messages = [{"role": "user", "content": body.query}]

    stream_mgr = claude.messages.stream(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        temperature=0,
        system=system,
        messages=messages,
    )

    try:
        stream = await stream_mgr.__aenter__()
    except Exception as exc:
        raise HTTPException(status_code=502, detail="AI service unavailable") from exc

    async def event_gen() -> AsyncGenerator[str, None]:
        full_response: list[str] = []
        start = time.monotonic()
        stream_error = False

        try:
            async for text in stream.text_stream:
                full_response.append(text)
                yield f"data: {json.dumps({'type': 'token', 'content': text})}\n\n"
        except Exception:
            stream_error = True
        finally:
            await stream_mgr.__aexit__(None, None, None)

        ms = int((time.monotonic() - start) * 1000)

        if not stream_error:
            yield f"data: {json.dumps({'type': 'done', 'conversation_id': conversation_id, 'latency_ms': ms})}\n\n"
            yield "data: [DONE]\n\n"
            try:
                supabase.table("chat_logs").insert(
                    {
                        "trip_id": trip_id,
                        "conversation_id": conversation_id,
                        "query": body.query,
                        "retrieved_chunks": chunks,
                        "response": "".join(full_response),
                        "latency_ms": ms,
                        "guardrail_classification": classification,
                    }
                ).execute()
            except Exception:
                pass

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
