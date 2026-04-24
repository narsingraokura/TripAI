"""Itinerary advisor prompt template.

Usage:
    from app.services.itinerary_context import build_itinerary_context
    from app.prompts.itinerary_advisor import build_advisor_prompt

    context = build_itinerary_context(trip_id, supabase_client)
    prompt = build_advisor_prompt(context, "Add a boat tour on Jun 28")
    # Pass prompt as the system message; no user message needed.
"""
from __future__ import annotations

import json
import warnings
from typing import Any

TOKEN_WARN_THRESHOLD = 8000

# ── Few-shot examples ─────────────────────────────────────────────────────────
# Each example is a dict: mutation_description → expected JSON output.
# Included verbatim in the system prompt so the model learns the output schema.

_FEW_SHOT_EXAMPLES = [
    {
        "label": "Example 1 — ok (no constraint impact)",
        "mutation": (
            "Add a free self-guided walking tour of Shoreditch street art "
            "on the afternoon of Jun 21 (London, moderate day)."
        ),
        "output": json.dumps(
            {
                "status": "ok",
                "messages": [
                    "A free Shoreditch street-art walk fits perfectly: "
                    "zero cost, low effort, and the day's intensity stays moderate."
                ],
                "affected_constraints": [],
                "suggestions": [],
            },
            indent=2,
        ),
    },
    {
        "label": "Example 2 — warning (expensive option near budget cap)",
        "mutation": (
            "Replace the picnic at Champ de Mars with dinner at Le Jules Verne "
            "(Eiffel Tower restaurant, €200/person × 4 = ~$900) on Jun 24 in Paris."
        ),
        "output": json.dumps(
            {
                "status": "warning",
                "messages": [
                    "Le Jules Verne costs ~$900 for the family. "
                    "This does not yet breach the budget cap but brings total estimated "
                    "spend meaningfully closer to it. Consider whether the splurge "
                    "is worth reserving headroom for later in the trip."
                ],
                "affected_constraints": ["budget_cap"],
                "suggestions": [
                    {
                        "type": "alternative",
                        "description": (
                            "Brasserie de la Tour Eiffel on the 1st floor: "
                            "same iconic view at ~$120/person — saves ~$320."
                        ),
                        "day": "2026-06-24",
                    },
                    {
                        "type": "alternative",
                        "description": (
                            "Picnic with charcuterie and wine from Rue Cler market: "
                            "~$60 total — saves ~$840 while staying on the Champ de Mars."
                        ),
                        "day": "2026-06-24",
                    },
                ],
            },
            indent=2,
        ),
    },
    {
        "label": "Example 3 — violation (removing a must_visit day, 3 resolution options)",
        "mutation": (
            "Remove Jun 26 entirely (Paris special day — Montmartre and anniversary dinner "
            "at Septime) to shorten the Paris leg by one night."
        ),
        "output": json.dumps(
            {
                "status": "violation",
                "messages": [
                    "Jun 26 is the designated anniversary day and is listed as a "
                    "must_visit special occasion. Removing it violates the must_visit "
                    "constraint and eliminates the anniversary dinner booking at Septime."
                ],
                "affected_constraints": ["must_visit: Montmartre / Anniversary dinner"],
                "suggestions": [
                    {
                        "type": "modification",
                        "description": (
                            "Compress Jun 25 and Jun 26 into a single full day: "
                            "Louvre in the morning, anniversary dinner at Septime in "
                            "the evening. Drop Musée d'Orsay to a quick 1-hour visit."
                        ),
                        "day": "2026-06-25",
                    },
                    {
                        "type": "relocation",
                        "description": (
                            "Move the Montmartre / Septime evening to Jun 25 and "
                            "free up Jun 26 for travel prep or an early Eurostar."
                        ),
                        "day": "2026-06-25",
                    },
                    {
                        "type": "modification",
                        "description": (
                            "Keep Jun 26 but swap the full Montmartre morning for a "
                            "shorter 2-hour visit, giving time to check out of the "
                            "hotel and catch a late-afternoon Eurostar to Interlaken."
                        ),
                        "day": "2026-06-26",
                    },
                ],
            },
            indent=2,
        ),
    },
]


# ── System prompt template ────────────────────────────────────────────────────

SYSTEM_PROMPT_TEMPLATE = """\
You are an itinerary advisor for the TripAI trip planner.
Your job is to evaluate a proposed change ("mutation") to an existing itinerary
and return a structured JSON verdict.

## Family profile
- 4 travelers: 2 adults (Indian passports, US H-1B visa), 2 children (US passports)
- Diet: Hindu non-vegetarian — no beef, no pork
- Special care: visa limitations apply; avoid countries requiring tourist visas for Indian nationals

## Trip goals
{goals}

## Trip constraints
{constraints}

## Current itinerary
```json
{itinerary_json}
```

## Constraint status (deterministic checks)
```json
{constraint_status_json}
```

## Output schema
Respond with ONLY a valid JSON object — no prose, no markdown fences, no explanation.
The object must have exactly these fields:

```json
{{
  "status": "ok" | "warning" | "violation",
  "messages": ["<one or more human-readable sentences explaining the verdict>"],
  "affected_constraints": ["<constraint description or id for each constraint impacted>"],
  "suggestions": [
    {{
      "type": "alternative" | "modification" | "relocation",
      "description": "<specific, actionable suggestion>",
      "day": "<YYYY-MM-DD or null>"
    }}
  ]
}}
```

Rules:
- "ok": mutation fits the goals, respects all constraints, no warnings needed.
- "warning": mutation is allowed but has a notable trade-off (cost spike, intensity overload, etc.).
- "violation": mutation breaches one or more hard constraints. Always provide 2–3 suggestions.
- "suggestions" is empty for "ok". For "warning" provide 1–2 alternatives. For "violation" provide 2–3.
- Every suggestion must be specific and actionable — no vague advice.

## Examples (learn the output shape)

{few_shot_examples}

## Proposed mutation to evaluate
{mutation_description}
"""


# ── Helpers ───────────────────────────────────────────────────────────────────

def format_goals(goals: list[dict[str, Any]]) -> str:
    if not goals:
        return "(none specified)"
    lines = []
    for g in goals:
        label = g.get("label") or g.get("description") or str(g)
        gtype = g.get("goal_type", "")
        prefix = f"[{gtype}] " if gtype else ""
        lines.append(f"- {prefix}{label}")
    return "\n".join(lines)


def format_constraints(constraints: list[dict[str, Any]]) -> str:
    if not constraints:
        return "(none specified)"
    lines = []
    for c in constraints:
        ctype = c.get("constraint_type", "custom")
        description = c.get("description", "")
        value = c.get("value")
        if value is not None:
            lines.append(f"- [{ctype}] {description} (value: {value})")
        else:
            lines.append(f"- [{ctype}] {description}")
    return "\n".join(lines)


def _format_few_shot_examples() -> str:
    parts = []
    for ex in _FEW_SHOT_EXAMPLES:
        parts.append(
            f"### {ex['label']}\n"
            f"**Mutation:** {ex['mutation']}\n\n"
            f"**Response:**\n```json\n{ex['output']}\n```"
        )
    return "\n\n".join(parts)


def token_estimate(prompt: str) -> int:
    """Rough token estimate: word_count × 1.3. Warns when > 8 000 tokens."""
    words = len(prompt.split())
    estimate = int(words * 1.3)
    if estimate > TOKEN_WARN_THRESHOLD:
        warnings.warn(
            f"Prompt token estimate {estimate} exceeds {TOKEN_WARN_THRESHOLD}. "
            "Consider trimming the itinerary JSON or reducing few-shot examples.",
            stacklevel=2,
        )
    return estimate


def build_advisor_prompt(context: dict[str, Any], mutation_description: str) -> str:
    """Build the full system prompt for the itinerary advisor.

    Returns a string ready to pass as the `system` parameter to the Claude API.
    The mutation_description is embedded in the prompt — no separate user message needed.
    """
    goals_text = format_goals(context.get("goals", []))
    constraints_text = format_constraints(context.get("constraints", []))

    days_for_json = context.get("days", [])
    itinerary_json = json.dumps(days_for_json, indent=2)

    constraint_status = context.get("summary", {}).get("constraint_status", [])
    constraint_status_json = json.dumps(constraint_status, indent=2)

    few_shot_text = _format_few_shot_examples()

    prompt = SYSTEM_PROMPT_TEMPLATE.format(
        goals=goals_text,
        constraints=constraints_text,
        itinerary_json=itinerary_json,
        constraint_status_json=constraint_status_json,
        few_shot_examples=few_shot_text,
        mutation_description=mutation_description,
    )

    token_estimate(prompt)
    return prompt
