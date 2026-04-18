#!/bin/bash
# ─── TripAI Evals Framework — Validation Checklist ───

echo "=== PHASE 1: File existence ==="

FILES=(
  "apps/api/evals/golden_factual.json"
  "apps/api/evals/golden_guardrail.json"
  "apps/api/evals/golden_reasoning.json"
  "apps/api/evals/golden_misc.json"
  "apps/api/evals/golden_dataset.json"
  "apps/api/evals/test_rag_eval.py"
  "apps/api/evals/conftest.py"
  "apps/api/rag/guardrail.py"
  "apps/api/tests/test_guardrail.py"
  "apps/api/EVALS.md"
  ".github/workflows/evals.yml"
)

ALL_EXIST=true
for f in "${FILES[@]}"; do
  if [ -f "$f" ]; then
    echo "  ✅ $f"
  else
    echo "  ❌ MISSING: $f"
    ALL_EXIST=false
  fi
done

echo ""
echo "=== PHASE 2: Golden dataset counts ==="

# Check each category file has the right number of pairs
for f in golden_factual golden_guardrail golden_reasoning golden_misc; do
  FILE="apps/api/evals/${f}.json"
  if [ -f "$FILE" ]; then
    COUNT=$(python3 -c "import json; print(len(json.load(open('$FILE'))))" 2>/dev/null)
    echo "  $f: $COUNT pairs"
  fi
done

# Check merged dataset
MERGED="apps/api/evals/golden_dataset.json"
if [ -f "$MERGED" ]; then
  TOTAL=$(python3 -c "import json; print(len(json.load(open('$MERGED'))))" 2>/dev/null)
  echo "  golden_dataset (merged): $TOTAL pairs"
fi

echo ""
echo "=== PHASE 3: Category coverage ==="

# Show category distribution in merged dataset
if [ -f "$MERGED" ]; then
  python3 -c "
import json
from collections import Counter
data = json.load(open('$MERGED'))
counts = Counter(d['category'] for d in data)
for cat, n in sorted(counts.items()):
    print(f'  {cat}: {n}')
"
fi

echo ""
echo "=== PHASE 4: Guardrail integration ==="

# Check that chat.py imports the guardrail
if grep -q "classify_query" apps/api/routes/chat.py; then
  echo "  ✅ chat.py imports classify_query"
else
  echo "  ❌ chat.py does NOT import classify_query"
fi

# Check guardrail.py has the async function
if grep -q "async def classify_query" apps/api/rag/guardrail.py 2>/dev/null; then
  echo "  ✅ guardrail.py has classify_query"
else
  echo "  ❌ guardrail.py missing classify_query"
fi

echo ""
echo "=== PHASE 5: Existing tests still pass ==="
echo "  Run: cd apps/api && pytest -v --tb=short 2>&1 | tail -20"

echo ""
echo "=== PHASE 6: Eval runner syntax check ==="
echo "  Run: cd apps/api && python3 -c \"import evals.test_rag_eval\" 2>&1"

echo ""
echo "=== PHASE 7: DeepEval installed ==="
python3 -c "import deepeval; print(f'  ✅ DeepEval {deepeval.__version__}')" 2>/dev/null || echo "  ❌ DeepEval not installed"

echo ""
echo "=== PHASE 8: CI workflow syntax ==="
if [ -f ".github/workflows/evals.yml" ]; then
  python3 -c "
import yaml
with open('.github/workflows/evals.yml') as f:
    y = yaml.safe_load(f)
    triggers = list(y.get('on', {}).keys())
    jobs = list(y.get('jobs', {}).keys())
    print(f'  Triggers: {triggers}')
    print(f'  Jobs: {jobs}')
" 2>/dev/null || echo "  ⚠️  Install pyyaml to validate: pip install pyyaml"
fi

echo ""
if [ "$ALL_EXIST" = true ]; then
  echo "🟢 All files present. Run Phase 5 and 6 manually to confirm tests pass."
else
  echo "🔴 Some files missing. Check agent outputs above."
fi