"""Merge the four golden dataset JSON files into a single golden_dataset.json."""
import json
from pathlib import Path

EVALS_DIR = Path(__file__).parent.parent / "evals"

files = [
    "golden_factual.json",
    "golden_guardrail.json",
    "golden_reasoning.json",
    "golden_misc.json",
]

merged = []
for fname in files:
    merged.extend(json.loads((EVALS_DIR / fname).read_text()))

out = EVALS_DIR / "golden_dataset.json"
out.write_text(json.dumps(merged, indent=2))
print(f"Wrote {len(merged)} pairs to {out}")
