# Session Extraction Prompt

**How to use:** Paste everything below this line into your coding Claude session
at the end of (or during) a session to generate a SessionReport.
Paste the output into the "improve" session for analysis.

---

Generate a structured SessionReport for this coding session. Be honest and precise — 
this feeds a continuous improvement loop, so false positives are unhelpful.

Output ONLY valid JSON in this exact schema (no prose before or after):

```json
{
  "session": {
    "date": "<YYYY-MM-DD>",
    "duration_estimate": "<rough estimate: 15min / 30min / 1h / 2h+>",
    "goal_stated": "<the GOAL the user gave at session start, or null if none given>",
    "goal_achieved": "<yes | partial | no>",
    "deliverable": "<one sentence: what actually got built or changed>"
  },
  "prompts": {
    "total_count": <number of user messages>,
    "correction_count": <how many times user had to redirect or correct you>,
    "correction_examples": ["<brief description of each correction>"],
    "vague_prompt_count": <prompts that lacked clear success criteria>,
    "vague_prompt_examples": ["<brief description>"],
    "best_prompt": "<the user prompt that led to the best outcome — quote it>",
    "worst_prompt": "<the user prompt that caused most confusion or rework — quote it>"
  },
  "context": {
    "compacted": <true | false>,
    "compaction_count": <number of times context was compacted>,
    "files_read_count": <approximate number of files Claude read>,
    "unnecessary_reads": ["<files Claude read that turned out irrelevant>"],
    "context_waste_signals": ["<anything that bloated context unnecessarily>"]
  },
  "claude_md_compliance": {
    "violations": ["<specific rule from CLAUDE.md that was broken>"],
    "gaps": ["<things that came up that CLAUDE.md didn't cover but should>"],
    "unused_rules": ["<CLAUDE.md rules that were referenced but never applied this session>"]
  },
  "work_quality": {
    "rework_count": <how many times code was written then thrown away>,
    "tests_run": <true | false>,
    "build_verified": <true | false>,
    "approach_changed_midway": <true | false>,
    "approach_change_reason": "<why the approach changed, or null>"
  },
  "anti_patterns_observed": [
    "<list any: kitchen_sink_session | over_correction_spiral | over_specified_prompt | no_verification | infinite_exploration | vibe_coding | parallel_context_pollution>"
  ],
  "session_strengths": [
    "<specific things that worked well — be concrete>"
  ],
  "top_3_improvements": [
    "<most impactful change the user could make to their prompting or workflow>",
    "<second most impactful>",
    "<third most impactful>"
  ],
  "claude_md_suggested_additions": [
    "<specific line or rule to add to CLAUDE.md based on what was missing today>"
  ],
  "hook_opportunities": [
    "<specific hook that would have automated something manual today>"
  ],
  "raw_session_summary": "<3-5 sentence plain English summary of what happened>"
}
```

Fill every field. Use null for genuinely unknown values, not empty strings.
