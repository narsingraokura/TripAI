# TripAI — Claude Code Context

## Project overview
Family trip planning web + mobile app. AI-powered itinerary Q&A, 
real-time booking tracker, budget optimizer, and trip memories.

Current trip: Kura Family Europe 2026
- 4 travelers: 2 adults (Indian passports, US H-1B), 2 kids (US passports)
- Jun 19 – Jul 5, 2026
- Route: SFO → London (3 nights) → Paris (4 nights) → 
  Interlaken Switzerland (5 nights) → Milan (3 nights) → SFO
- Budget cap: $25,000
- Special dates: Anniversary Jun 26 (Paris), Birthday Jun 27 (Interlaken)
- Key activities: Titlis mountain day Jun 29, Skydiving Jul 1 (parents only)

## Tech stack
- Frontend: Next.js 15 (App Router), TypeScript, Tailwind CSS, shadcn/ui
- Backend: FastAPI (Python 3.11)
- Database: Supabase (Postgres)
- Auth: Clerk (to be added)
- AI: Anthropic Claude API (claude-3-5-sonnet-20241022)
- Vector DB: Qdrant (for RAG pipeline - Week 2)
- Deployment: Vercel (frontend), Railway (backend)

## Repo structure
TripAI/
├── CLAUDE.md
├── apps/
│   ├── web/          ← Next.js frontend
│   │   ├── app/      ← pages and routes (App Router)
│   │   ├── components/
│   │   │   └── ui/   ← shadcn components (never edit directly)
│   │   └── lib/      ← utilities
│   └── api/          ← FastAPI backend (not yet scaffolded)
└── docs/
├── trip-data.md
├── architecture.md
└── roadmap.md

## Commands
- Frontend dev: `cd apps/web && npm run dev` (port 3000)
- Frontend build: `cd apps/web && npm run build`
- Type check: `cd apps/web && npx tsc --noEmit`
- API dev: `cd apps/api && source venv/bin/activate && uvicorn main:app --reload` (port 8000)
- API tests: `cd apps/api && pytest -v`
- Frontend tests: `cd apps/web && npm test`

## What's built
- [x] Next.js scaffold with TypeScript + Tailwind
- [x] shadcn/ui components (button, badge, checkbox, progress, input, separator)
- [x] Booking checklist (14 items, all Kura family trip data hardcoded)
- [x] Interactive checkboxes with state (useState, lifted to Page)
- [x] Budget bar (updates as bookings are checked off)
- [x] Light mode forced (ThemeProvider removed)
- [ ] Supabase schema and seed data
- [ ] FastAPI backend scaffold
- [ ] Clerk auth
- [ ] Supabase Realtime sync
- [ ] RAG pipeline for trip Q&A
- [ ] Cost optimizer agent

## Database schema
Five tables. Every table has id (uuid), created_at, updated_at.
Every query MUST filter by trip_id — this is how multi-tenancy works.

### users
id, email, name, clerk_id (from Clerk auth), created_at

### trips  
id, name, owner_id (→ users), start_date, end_date, 
budget_cap (numeric), viewer_token (for share link), 
status (planning|active|completed)

### trip_members
trip_id (→ trips), user_id (→ users), role (owner|member)

### bookings
id, trip_id (→ trips), title, subtitle, category 
(flights|hotels|trains|activities|food|misc),
urgency (fire|now|soon), status (pending|booked),
estimated_cost (numeric), actual_cost (numeric nullable),
deadline (text), discount_code, card_tip, notes,
booked_by (→ users nullable), booked_at (timestamptz nullable)

### itinerary_days
id, trip_id (→ trips), date, city, country,
title, plan (text — this gets embedded into RAG),
intensity (light|moderate|busy|travel|special),
is_special (boolean), special_label (text nullable)

## Trip data
Full booking list and itinerary: see docs/trip-data.md

## Meta discount codes (Kura family)
- Accor: Company META · Code SC196337864 · Access FA564US684 (15% off)
- IHG: 100270748 (14% off)
- Hyatt: 151340 (Meta leisure rate)
- Hilton: 000027973 (outside Americas, 10% off)
- Marriott: FSF (1 room per booking)
- Venture X: $300 annual travel credit
- Amex Gold: 3X MR on flights, 2X on prepaid hotels via AmexTravel

## Credit card strategy
- Flights: Amex Gold (3X MR)
- Hotels with Accor/IHG/Hyatt codes: Amex Gold via AmexTravel (2X MR)
- Switzerland (CHF): Venture X (no FX fee)
- Return flight MXP→SFO: Venture X ($300 credit)
- Everything else Europe: Venture X (no FX fee)

## Architecture principles
VALUABLE: Useful · Intuitive · Consistent · Accessible · Operable · Responsive
SIMPLE: Modular · Reusable · Evolvable · Testable
EFFICIENT: Nimble · Iterable · Observable · Inexpensive  
TRUSTED: Correct · Resilient · Secure · Private · Compliant
Reference: https://github.com/isolis/principles

## Coding standards
- TypeScript strict mode — no `any` types ever
- Every component in its own file under components/
- No business logic in page.tsx — pages only compose components
- Every API route filters by trip_id (multi-tenancy from day 1)
- All DB queries go through the FastAPI backend — never call Supabase directly from frontend in production
- Foreign keys with ON DELETE CASCADE on all child tables
- uuid primary keys everywhere — never sequential integers
- created_at + updated_at on every table

## AI features (to be built)
1. RAG Q&A — "What hotel am I at Jun 26?" answers from actual trip docs
   - Qdrant vector DB, text-embedding-3-small, chunk size 512 tokens
   - Index: itinerary_days.plan + booking details + uploaded PDFs
   
2. Budget agent — "Are we optimizing every booking?"
   - Tools: get_budget_summary(), get_discount_codes(), get_card_recommendation()
   - Returns: exact savings per booking, which card to use, why

3. Eval harness (Week 5)
   - Faithfulness, answer relevance, context precision
   - LLM-as-judge with golden dataset of 20 trip Q&A pairs

## Session goal format
Start every Claude Code session with:
GOAL: [one specific deliverable]
CONTEXT: [which docs/files are relevant]
DONE WHEN: [specific verifiable outcome]
DO NOT: [guardrails — what to avoid]
Example:
GOAL: Create Supabase schema and seed all 14 bookings + 17 itinerary days
CONTEXT: CLAUDE.md bookings table, itinerary table, 14 bookings list, 17 days list
DONE WHEN: Tables exist in Supabase, seed script runs without errors,
SELECT COUNT(*) FROM bookings returns 14
DO NOT: Use sequential integer IDs, skip trip_id on any table,
create tables without created_at/updated_at
## Current session state
- Supabase project: being created
- Next immediate task: write schema.sql and seed.sql, run in Supabase
- Then: FastAPI scaffold, first API route GET /trips/{trip_id}/bookings