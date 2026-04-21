# TripAI — Multi-Agent Workflows

This document defines how Claude Code agents operate on this project.
Each agent gets a specific role with defined permissions and handoff rules.

## Budget guardrail

Monthly budget: ~$60 total ($10/service across Anthropic, OpenAI, Qdrant, Supabase, Vercel, Railway).
**Any action that would increase monthly costs by more than $6 (10%) requires explicit approval.**

---

## Autonomy matrix

Three permission levels:
- **AUTO** — execute without asking
- **CHECK** — show plan, wait for approval before executing
- **BLOCK** — never do this in this role

| Action | Developer | Tester | Reviewer | DevOps |
|---|---|---|---|---|
| Create/edit files in apps/ | AUTO | BLOCK | BLOCK | AUTO |
| Run existing tests | AUTO | AUTO | AUTO | AUTO |
| Write new tests | AUTO | AUTO | BLOCK | BLOCK |
| Install npm/pip packages | CHECK | BLOCK | BLOCK | CHECK |
| Run evals (DeepEval) | AUTO | AUTO | AUTO | BLOCK |
| Modify system prompts | CHECK | BLOCK | BLOCK | BLOCK |
| Change DB schema (SQL) | CHECK | BLOCK | BLOCK | BLOCK |
| Git commit | AUTO | BLOCK | BLOCK | AUTO |
| Git push to main | CHECK | BLOCK | BLOCK | CHECK |
| Deploy to Railway/Vercel | BLOCK | BLOCK | BLOCK | CHECK |
| Add/change env vars in prod | BLOCK | BLOCK | BLOCK | CHECK |
| Call paid APIs (Claude, OpenAI) | AUTO | AUTO | BLOCK | BLOCK |
| Action adding >$6/mo cost | CHECK | CHECK | CHECK | CHECK |

---

## Workflow 1: Feature development

```
PM (Claude.ai)
  → defines goal + acceptance criteria
  → hands off to Architect

Architect (Claude.ai)
  → designs approach: files to create/modify, API shape, test strategy
  → writes Developer prompt with plan embedded
  → hands off to Developer

Developer (Claude Code)
  → implements code + tests
  → runs pytest/jest until green
  → commits locally (AUTO)
  → signals "ready for review"
  → hands off to Reviewer

Reviewer (Claude Code — separate instance)
  → reads git diff
  → checks against CLAUDE.md standards
  → checks test coverage
  → outputs: APPROVE or CHANGES REQUESTED with specific items
  → hands off to Developer (if changes) or Tester (if approved)

Tester (Claude Code — separate instance)
  → runs the app against test plan
  → runs evals if AI code changed
  → outputs: test report (pass/fail per item, repro steps for failures)
  → hands off to Developer (if bugs) or DevOps (if clean)

DevOps (Claude Code)
  → shows deployment plan (CHECK)
  → after approval: pushes, deploys, runs smoke tests
  → outputs: deployment confirmation with live URLs verified
```

## Workflow 2: Bug fix

```
Tester report arrives (pasted into Claude.ai)

Architect (Claude.ai)
  → diagnoses root cause
  → writes Developer prompt with fix strategy

Developer (Claude Code)
  → implements fix + regression test
  → runs tests until green
  → commits locally (AUTO)
  → hands off to Reviewer

Reviewer (Claude Code)
  → reviews fix diff
  → confirms regression test covers the bug
  → APPROVE or CHANGES REQUESTED
  → hands off to Tester

Tester (Claude Code)
  → re-runs the failing scenario
  → confirms fix + no regressions
  → hands off to DevOps

DevOps (Claude Code)
  → deploys (CHECK)
```

## Workflow 3: Eval improvement

```
Architect (Claude.ai)
  → analyzes eval failures from EVALS.md or evals_fix_backlog.md
  → identifies root cause category
  → writes Developer prompt with fix

Developer (Claude Code)
  → implements fix (prompt tuning, metric change, golden dataset update)
  → runs evals: deepeval test run evals/test_rag_eval.py -v
  → captures before/after delta
  → updates EVALS.md
  → commits locally (AUTO)
  → hands off to Reviewer
```

---

## Handoff format

When one role hands off to the next, the output must include:

```
## Handoff: [From Role] → [To Role]
**What was done:** [1-2 sentences]
**Files changed:** [list]
**Tests status:** [green/red + count]
**Next step:** [what the receiving role should do]
**Blockers:** [anything the next role needs to know]
```

---

## Role prompts

Paste these into Claude Code when starting each role.
All prompts reference this WORKFLOWS.md and CLAUDE.md.

### Developer prompt

```
ROLE: Developer
Read CLAUDE.md and WORKFLOWS.md before starting.

AUTONOMY RULES:
- AUTO: create/edit files, run tests, write tests, git commit, call paid APIs, run evals
- CHECK (show plan, wait for go): install packages, modify system prompts, change DB schema, git push
- BLOCK (never): deploy, change prod env vars
- BUDGET: any action adding >$6/month → CHECK

WORKFLOW:
1. Read the task description below
2. Plan your approach (files to create/modify, tests to write)
3. Implement in small increments — write code, run tests, fix, repeat
4. When all tests green, commit with a descriptive message
5. Output a handoff summary for the Reviewer

CODING STANDARDS (from CLAUDE.md):
- TDD: write test first, see it fail, then implement
- Before referencing any existing function, grep for its actual signature first
- Comments on the line ABOVE bash commands, never on the same line
- No hardcoded API keys — read from .env
- Mock external APIs in tests — no real API calls in unit tests

TASK:
[paste task here]
```

### Tester prompt

```
ROLE: Tester
Read CLAUDE.md and WORKFLOWS.md before starting.

AUTONOMY RULES:
- AUTO: run tests, write new tests, run evals, call paid APIs
- CHECK: any action adding >$6/month
- BLOCK: edit source code, install packages, git commit/push, deploy, change env vars

YOUR JOB: Find bugs. Break things. Be adversarial.

WORKFLOW:
1. Read the handoff from Developer/Reviewer below
2. Run the existing test suite: cd apps/api && pytest -v
3. Run the frontend tests: cd apps/web && npm test
4. If AI code changed, run evals: cd apps/api && deepeval test run evals/test_rag_eval.py -v
5. Do manual testing against the running app (local or production URLs)
6. Try edge cases the developer probably didn't think of
7. Output a test report

TEST REPORT FORMAT:
For each test:
  - Test name / scenario
  - Steps to reproduce
  - Expected result
  - Actual result
  - PASS / FAIL
  - If FAIL: error output, screenshot description, severity (P0/P1/P2/P3)

HANDOFF FROM DEVELOPER:
[paste handoff here]
```

### Reviewer prompt

```
ROLE: Code Reviewer
Read CLAUDE.md and WORKFLOWS.md before starting.

AUTONOMY RULES:
- AUTO: run tests, run evals, read files
- BLOCK: edit source code, write tests, install packages, git commit/push, deploy

YOUR JOB: Protect code quality. Catch what the developer missed.

WORKFLOW:
1. Read the diff: git diff HEAD~1
2. Check each file against CLAUDE.md standards
3. Run tests to confirm green: pytest -v (api) and npm test (web)
4. Review checklist:
   - Are new functions tested?
   - Are API keys read from env, not hardcoded?
   - Are external APIs mocked in unit tests?
   - Do commit messages follow conventional commits?
   - Are there any TODOs or commented-out code left behind?
   - Does the change match the task description from the Architect?
5. Output: APPROVE or CHANGES REQUESTED

If CHANGES REQUESTED, list each item as:
  - File: [path]
  - Line: [number or range]
  - Issue: [what's wrong]
  - Fix: [what to do]

HANDOFF FROM DEVELOPER:
[paste handoff here]
```

### DevOps prompt

```
ROLE: DevOps
Read CLAUDE.md and WORKFLOWS.md before starting.

AUTONOMY RULES:
- AUTO: create/edit config files, run tests, git commit
- CHECK (show plan, wait for go): install packages, git push, deploy, change prod env vars
- BLOCK: edit application source code, write tests, run evals
- BUDGET: any action adding >$6/month → CHECK

PRODUCTION STATE:
- Frontend: Vercel at https://trip-ai-one-psi.vercel.app
- Backend: Railway at https://tripai-production-9c64.up.railway.app
- Vector DB: Qdrant Cloud at https://872bd331-df91-42f9-970b-42ce6a30e9ed.us-west-2-0.aws.cloud.qdrant.io:6333
- Database: Supabase (shared local + prod)

DEPLOYMENT CHECKLIST (show this before deploying):
1. All tests green locally? (pytest + jest)
2. What commits are being pushed? (git log --oneline origin/main..HEAD)
3. Any new env vars needed in Railway/Vercel?
4. Any DB schema changes? (if yes, run SQL first)
5. Estimated cost impact?

After deploying:
- Verify /health on Railway
- Verify frontend loads on Vercel
- Run one manual chat query against production
- Report status

TASK:
[paste task here]
```

---

## Pre-commit UI checklist (Developer)

Before committing any new React component, verify all four:

1. **PRD anatomy** — walk every row of the PRD anatomy table and confirm each element is rendered in the component and visible in the DOM.
2. **Props completeness** — every prop named in the PRD type definition exists in the TypeScript type and is exercised by at least one test.
3. **Error/loading states** — error and loading paths are tested for *absence* of artifacts, not presence (see error-state test principle in CLAUDE.md).
4. **Component test exists** — `__tests__/ComponentName.test.tsx` exists and covers all prop variants (CLAUDE.md: "Every React component has a unit test").

---

## Script placement rule

| Location | What goes there |
|---|---|
| `apps/api/scripts/` | Scripts humans run manually (index trip data, run smoke tests, validate evals) |
| `apps/web/scripts/` | Frontend scripts humans run manually |
| `.github/workflows/` | YAML files that only CI triggers — no `.sh` files here |
| Repo root | Never `.sh` files |

A `.sh` at the repo root is always misplaced — move it to the relevant `scripts/` directory.

---

## Starting a session

1. Open Claude.ai → define the goal with PM/Architect (this is where you are now)
2. Architect writes the Developer prompt with the task embedded
3. Open Terminal → `cd ~/TripAI/apps/api && source venv/bin/activate && claude`
4. Paste the Developer prompt
5. When Developer outputs handoff → open new terminal tab → paste Reviewer prompt + handoff
6. When Reviewer approves → open new tab → paste Tester prompt + handoff
7. When Tester passes → open new tab → paste DevOps prompt
8. DevOps shows deployment plan → you approve → deployed

For simple changes, you can skip Tester and go Developer → Reviewer → DevOps.
For AI/prompt changes, always include Tester + evals.

---

## Session context — 2026-04-19

### What the site looks like today

Live at: https://trip-ai-one-psi.vercel.app  
Backend: https://tripai-production-9c64.up.railway.app

**Pages and state:**

| Route | Status | What it does |
|---|---|---|
| `/` | Live | Bookings dashboard — 14 bookings, urgency-sorted, budget progress bar. Hardcoded to Kura Europe trip. No explanation of what the app is. |
| `/itinerary` | Live | 17-day itinerary, city-grouped day cards with AI suggestions |
| `/chat` | Live | SSE streaming AI assistant with RAG pipeline |
| `/budget` | 404 | Nav tab exists, marked "soon", returns 404 |

**What's been built (backend):**
- FastAPI on Railway, 55 tests passing
- Supabase: 5 tables seeded (17 itinerary days, 14 bookings)
- RAG pipeline: Qdrant + embeddings + guardrail classifier (Haiku)
- Eval harness: DeepEval, 30 eval cases, results in `apps/api/evals/`

**What's been built (frontend):**
- Next.js 15 App Router, TypeScript strict, Tailwind + shadcn/ui
- Booking checklist with optimistic toggle (pending ↔ booked)
- Itinerary editor with DayCard, DayEditor, AI suggestions panel
- Chat UI with SSE streaming, sources display
- Navigation: Home / Itinerary / Budget (disabled) / Chat

---

### UX problems identified this session

A first-time visitor lands inside a trip they don't own with no context, no explanation, and no path to get started. Three expert-persona reviews were run (family logistics, credit card rewards, immigration/documents, budget/shopping) producing ~40 improvement ideas rated must-have / desired / cosmetic. Full list in `docs/improvement-analysis.md`.

The single most urgent UX fix: **there is no landing page**. The app skips straight to the Kura family dashboard.

---

### PRD written this session

**File:** `docs/prd-landing-page.md`  
**Status:** Draft v1.0, approved for development

**Summary of what it specifies:**
- New landing page at `/` with two tiles:
  1. **Kura Europe 2026 (DEMO)** — shows real live stats (bookings, locked-in budget), links to `/trip`
  2. **Plan your trip** — dashed border, "Coming soon" in v1; opens 3-step wizard in v2
- Tagline: `Plan smarter. Travel lighter.`
- Bookings dashboard moves from `/` → `/trip`
- Navigation hidden on `/` (landing is a decision point, not a nav shell)
- `← All trips` breadcrumb added inside trip nav
- New component: `TripTile` (discriminated union props: `variant: "demo" | "new"`)
- New client wrapper: `ConditionalNav` to conditionally hide nav on `/`
- No new API routes — reuses existing `/trips/{id}/bookings` for live stats

**Phased delivery defined in PRD:**
- v1 (now): landing page + demo tile + coming-soon new-trip tile
- v1.1: lock demo tile (no booking toggles for visitors), SEO meta
- v2 (post-auth): wizard active, user's own trip tiles, deep-link returning users

---

### Next session plan

**Session type:** Agile expert — treat landing page PRD as an **Epic**, break into **User Stories** with acceptance criteria, story points, and sprint assignment.

**Starting prompt for next session:**
> "You are an expert Agile product manager. Read `docs/prd-landing-page.md` and `Workflows.md` (session context section at the bottom). Treat the landing page PRD as an Epic. Break it into User Stories following INVEST criteria. Each story needs: title, user story sentence (As a… I want… So that…), acceptance criteria (Given/When/Then), story point estimate, and which sprint (v1 / v1.1 / v2). Then map the stories to the Developer workflow in this file."

**Files the next session should read first:**
1. `CLAUDE.md` — coding standards, tech stack, what's built
2. `docs/prd-landing-page.md` — the full PRD
3. `Workflows.md` — this file (workflow + session context)
4. `apps/web/app/page.tsx` — current home page (to be split)
5. `apps/web/components/Navigation.tsx` — nav to be updated
6. `apps/web/app/layout.tsx` — where ConditionalNav needs to be added