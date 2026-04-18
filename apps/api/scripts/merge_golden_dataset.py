"""Merge the four golden dataset fragments into golden_dataset.json."""
import json
from pathlib import Path

EVALS_DIR = Path(__file__).parent.parent / "evals"
SOURCES = [
    "golden_factual.json",
    "golden_guardrail.json",
    "golden_reasoning.json",
    "golden_misc.json",
]

merged: list[dict] = []
for filename in SOURCES:
    pairs = json.loads((EVALS_DIR / filename).read_text(encoding="utf-8"))
    merged.extend(pairs)
    print(f"  {filename}: {len(pairs)} pairs")

output_path = EVALS_DIR / "golden_dataset.json"
output_path.write_text(json.dumps(merged, indent=2, ensure_ascii=False), encoding="utf-8")
print(f"\nWrote {len(merged)} pairs → {output_path}")
