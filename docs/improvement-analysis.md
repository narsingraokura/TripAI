# Improvement Analysis Framework

When a SessionReport is pasted into the "improve" session, run this analysis:

## 1. Triage by signal strength

Score each report field for signal quality:

| Signal | Red flag threshold | What it means |
|--------|-------------------|---------------|
| `correction_count` | ≥ 3 | Prompts are under-specified; add more DONE WHEN criteria |
| `vague_prompt_count` | ≥ 2 | Goal framing is weak; use GOAL/CONTEXT/DONE WHEN/DO NOT format every time |
| `compaction_count` | ≥ 2 | Session is too long; break into smaller focused sessions |
| `rework_count` | ≥ 2 | Approach wasn't validated before execution; use Plan Mode first |
| `unnecessary_reads` | any | CLAUDE.md context section can be tightened |
| `anti_patterns_observed` | any | Address immediately — these degrade quality exponentially |

## 2. CLAUDE.md diff

For each item in `claude_md_suggested_additions`:
- Check if it would have prevented a correction or rework
- If yes, recommend adding it with exact phrasing
- If it's covered by existing text, recommend making that rule more prominent (add "IMPORTANT:")

## 3. Hook candidates

For each item in `hook_opportunities`:
- Identify the lifecycle event (PostToolUse / PreToolUse / Stop / etc.)
- Draft the hook command
- Specify whether it belongs in ~/.claude/settings.json (personal) or .claude/settings.json (project)

## 4. Session structure score (1–10)

Rate the session on:
- Goal clarity (was GOAL/CONTEXT/DONE WHEN/DO NOT used?)
- Verification (were tests run? build checked?)
- Context efficiency (was compaction needed? unnecessary files read?)
- Prompt quality (corrections vs total prompts ratio)
- Outcome (goal_achieved value)

## 5. One keystone recommendation

The single highest-leverage change that would most improve the next session.
This should be specific and actionable in < 5 minutes to implement.

---

## Accumulated Patterns Log

Track patterns across sessions here. Add a row after each analysis.

| Date | Correction Rate | Top Anti-Pattern | Keystone Rec Applied? |
|------|----------------|-----------------|----------------------|
| (first session pending) | — | — | — |
