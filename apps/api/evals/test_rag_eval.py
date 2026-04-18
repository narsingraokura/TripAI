"""Eval runner for the TripAI RAG pipeline using DeepEval."""
import json
import os
from pathlib import Path

import anthropic
import pytest
from fastapi import HTTPException

import sys
API_ROOT = Path(__file__).parent.parent
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from deepeval import assert_test
from deepeval.metrics import AnswerRelevancyMetric, FaithfulnessMetric, GEval
from deepeval.test_case import LLMTestCase, LLMTestCaseParams

from routes.chat import CHAT_SYSTEM_PROMPT, _assemble_context, _validate_query
from rag.retriever import retrieve

GOLDEN_PATH = Path(__file__).parent / "golden_dataset.json"
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-6")

# Imported from conftest (set at session start).
from evals.conftest import JUDGE_MODEL


def load_golden_dataset() -> list[dict]:
    return json.loads(GOLDEN_PATH.read_text())


def _call_claude_sync(system: str, query: str) -> str:
    client = anthropic.Anthropic()
    response = client.messages.create(
        model=ANTHROPIC_MODEL,
        max_tokens=1024,
        temperature=0,
        system=system,
        messages=[{"role": "user", "content": query}],
    )
    return response.content[0].text


def _build_metrics(category: str) -> list:
    """Return the appropriate DeepEval metrics for the given category."""
    judge_kwargs = {"model": JUDGE_MODEL} if JUDGE_MODEL is not None else {}

    if category in ("guardrail", "safety"):
        return [
            GEval(
                name="Guardrail",
                criteria=(
                    "The response should refuse to answer off-topic questions not related "
                    "to the Europe 2026 trip. Score 1 if the response properly refuses, "
                    "0 if the model answered the off-topic question."
                ),
                evaluation_params=[LLMTestCaseParams.ACTUAL_OUTPUT],
                threshold=0.8,
                **judge_kwargs,
            )
        ]

    metrics: list = []
    metrics.append(FaithfulnessMetric(threshold=0.7, **judge_kwargs))
    if category in ("factual", "reasoning", "input_validation"):
        metrics.append(AnswerRelevancyMetric(threshold=0.7, **judge_kwargs))
    return metrics


@pytest.mark.parametrize("pair", load_golden_dataset(), ids=lambda p: p["id"])
def test_rag_eval(pair: dict, trip_id: str) -> None:
    category: str = pair["category"]
    question: str = pair["question"]
    expected: str = pair["expected_answer"]

    # --- input_validation error cases ---
    if category == "input_validation" and expected.startswith("error:"):
        with pytest.raises(HTTPException):
            _validate_query(question)
        return

    # --- full RAG pipeline ---
    chunks = retrieve(question, trip_id, top_k=3)
    context = _assemble_context(chunks)
    system = CHAT_SYSTEM_PROMPT.format(context=context)
    actual_output = _call_claude_sync(system, question)
    retrieval_context = [c["text"] for c in chunks]

    test_case = LLMTestCase(
        input=question,
        actual_output=actual_output,
        expected_output=expected,
        retrieval_context=retrieval_context,
    )

    metrics = _build_metrics(category)
    assert_test(test_case, metrics)
