"""Pytest configuration for the eval suite."""
import os
import sys
from pathlib import Path

import pytest
from dotenv import load_dotenv

# Ensure apps/api is on the path so rag/routes imports work.
API_ROOT = Path(__file__).parent.parent
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

load_dotenv(API_ROOT / ".env")


def _make_claude_judge():
    """Return a ClaudeJudge instance if ANTHROPIC_API_KEY is set, else None."""
    if not os.getenv("ANTHROPIC_API_KEY"):
        return None
    try:
        import anthropic
        from deepeval.models.base_model import DeepEvalBaseLLM

        class ClaudeJudge(DeepEvalBaseLLM):
            def __init__(self) -> None:
                self._model = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-6")
                self._sync = anthropic.Anthropic()
                self._async = anthropic.AsyncAnthropic()

            def load_model(self):
                return self._sync

            def generate(self, prompt: str, **_) -> str:
                resp = self._sync.messages.create(
                    model=self._model,
                    max_tokens=2048,
                    messages=[{"role": "user", "content": prompt}],
                )
                return resp.content[0].text

            async def a_generate(self, prompt: str, **_) -> str:
                resp = await self._async.messages.create(
                    model=self._model,
                    max_tokens=2048,
                    messages=[{"role": "user", "content": prompt}],
                )
                return resp.content[0].text

            def get_model_name(self) -> str:
                return self._model

        return ClaudeJudge()
    except Exception:
        return None


# Expose globally so test_rag_eval can import it.
JUDGE_MODEL = _make_claude_judge()


@pytest.fixture(scope="session")
def trip_id() -> str:
    """Return the first trip UUID from Supabase."""
    from supabase import create_client

    url = os.getenv("SUPABASE_URL", "")
    key = os.getenv("SUPABASE_KEY", "")
    client = create_client(url, key)
    result = client.table("trips").select("id").limit(1).execute()
    assert result.data, "No trips found in Supabase — seed the database first"
    return result.data[0]["id"]
