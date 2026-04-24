# Story Prompt Template

Copy this template, fill in the bracketed sections, and paste into a fresh Claude Code session.
The role template and skill files carry the conventions — keep the story prompt focused on
WHAT to build, not HOW to build it.

---

## Story: [STORY-ID] — [Story Title]

**Role:** Read and follow `.claude/roles/[developer|reviewer|tester|devops].md`

**Skills:** Read these before starting:
- `.claude/skills/tripai-conventions.md`
- `.claude/skills/itinerary-editor.md`
- [add or remove skill files as needed]

**Branch:** `[branch-name]`

**Requirements:**
[Paste the acceptance criteria from the PRD — bullet list, Given/When/Then, or table]

**Technical Guidance:**
[Story-specific notes: which files to modify, which existing patterns to follow,
integration points with other stories, any non-obvious constraints]

**What NOT To Do:**
[Story-specific scope boundaries — things explicitly out of scope for this ticket]

---

## Usage Example

**Developer prompt for EDIT-02 (Add a Day):**

```
## Story: EDIT-02 — Add a Day

**Role:** Read and follow `.claude/roles/developer.md`

**Skills:** Read these before starting:
- `.claude/skills/tripai-conventions.md`
- `.claude/skills/itinerary-editor.md`

**Branch:** `feat/edit-02-add-day`

**Requirements:**
- "Add Day" button visible between every pair of day cards AND at the end of the list
- Clicking opens AddDayForm: date (auto-calculated from adjacent days), city, country, intensity
- POST /trips/{trip_id}/itinerary with the new day data
- After add: re-fetch itinerary so the new card appears in the correct position
- Optimistic UI: card appears immediately, confirmed on API success, rolled back on failure

**Technical Guidance:**
- AddDayForm already exists at apps/web/components/itinerary/AddDayForm.tsx — read it first
- createItineraryDay() in lib/api.ts already sends X-API-Key — no changes needed there
- POST /trips/{trip_id}/itinerary route already exists in main.py (returns 201)
- Wire into ItineraryView state — follow the same lifted-state pattern used by DayCard
- New day must respect demo mode: hide "Add Day" button when useIsDemo() is true

**What NOT To Do:**
- Don't modify the database schema
- Don't change existing DayCard, DayEditor, or CityGroup props
- Don't implement drag-to-reorder (that's EDIT-05)
```

---

## Composability Rules

A story prompt is intentionally short (~30 lines). Do NOT add to it:
- Coding standards — those live in `CLAUDE.md` and the role template
- Workflow instructions — those live in the role template
- Domain knowledge about components or API shapes — those live in the skill file

If you find yourself adding conventions to a story prompt, move them to the right file:
- Project-wide rule → `CLAUDE.md`
- Role behavior → `.claude/roles/[role].md`
- Feature domain knowledge → `.claude/skills/[domain].md`
