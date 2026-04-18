"""Measure Haiku classifier pass rate against the golden reject cases."""
import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from rag.guardrail import classify_query

GOLDEN_PATH = Path(__file__).parent.parent / "evals" / "golden_dataset.json"


async def main() -> None:
    pairs = json.loads(GOLDEN_PATH.read_text())
    reject_cases = [p for p in pairs if p.get("eval_criteria", {}).get("guardrail") == "reject"]
    answer_cases = [p for p in pairs if p.get("eval_criteria", {}).get("guardrail") == "answer"]

    print(f"\n=== Haiku classifier: {len(reject_cases)} REJECT cases ===")
    tp = 0
    for pair in reject_cases:
        verdict = await classify_query(pair["question"])
        correct = verdict == "off_topic"
        if correct:
            tp += 1
        status = "✓ BLOCKED" if correct else "✗ LEAKED"
        print(f"  [{status}] ({pair['id']}) {pair['question'][:60]!r}")

    print(f"\n=== Haiku classifier: {len(answer_cases)} ANSWER cases (false positive check) ===")
    tn = 0
    for pair in answer_cases:
        verdict = await classify_query(pair["question"])
        correct = verdict == "trip"
        if correct:
            tn += 1
        status = "✓ ALLOWED" if correct else "✗ BLOCKED (false positive)"
        print(f"  [{status}] ({pair['id']}) {pair['question'][:60]!r}")

    print(f"\n=== Summary ===")
    print(f"  True positives (off-topic correctly blocked): {tp}/{len(reject_cases)} = {tp/len(reject_cases)*100:.0f}%")
    print(f"  True negatives (trip questions correctly allowed): {tn}/{len(answer_cases)} = {tn/len(answer_cases)*100:.0f}%")
    print(f"  False negatives (off-topic leaked through):  {len(reject_cases)-tp}/{len(reject_cases)}")
    print(f"  False positives (trip questions falsely blocked): {len(answer_cases)-tn}/{len(answer_cases)}")


asyncio.run(main())
