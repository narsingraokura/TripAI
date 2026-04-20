# PRD: TripAI Landing Page

**Document owner:** Product  
**Status:** Draft v1.0  
**Last updated:** 2026-04-19  
**Target release:** v1 (landing page + demo tile only)

---

## 1. Overview

### 1.1 Summary

TripAI currently has no landing page. A first-time visitor arrives directly inside a trip dashboard they don't own, with no explanation of what the product does or how to get started. This PRD defines the landing page that replaces `/` — a minimal, card-based entry point that communicates the product's value, lets visitors explore a fully-planned demo trip, and gives future users a path to start their own.

### 1.2 Problem Statement

| Visitor type | Current experience | Impact |
|---|---|---|
| First-time visitor | Sees "Kura Family · Europe 2026" with no context | Confused — thinks this is someone else's app |
| Curious explorer | No way to see what TripAI does before committing | Bounces immediately |
| Prospective user | No "get started" path exists | Can't self-serve |
| Returning user | Lands on home, already knows where to go | Unnecessary friction (addressed in v2 with auth) |

### 1.3 Goals

1. A visitor understands what TripAI does within 5 seconds of landing
2. They can explore a fully-planned real trip to experience the product before signing up
3. They have exactly one clear next action from the landing page
4. The landing page does not interfere with returning users navigating to their trip

### 1.4 Non-Goals (v1)

- User authentication or login (Clerk — separate PRD)
- Actual trip creation backend (wizard captures data, stored locally or held until auth ships)
- Multi-trip management per user
- Search or filtering of trips
- Marketing copy, pricing tiers, or growth loops
- Any animation or illustration beyond static card design

---

## 2. User Personas

### 2.1 The Explorer
**Who:** Heard about TripAI from a friend or link-share. No trip planned yet. Wants to understand what the product does before investing any time.  
**Need:** Understand the product and its value in under 10 seconds. See a real example of what "done" looks like.  
**Success:** Opens the Kura Europe demo tile and browses at least two tabs (e.g. Bookings + Chat).

### 2.2 The Planner
**Who:** Has a concrete trip in mind (dates, destinations, rough budget). Ready to start immediately. Wants the fastest path to a working trip plan.  
**Need:** A clear "start here" action that doesn't bury them in a wall of empty form fields.  
**Success:** Completes the 3-step trip wizard and lands on their new (empty) trip dashboard.

### 2.3 The Demo Viewer
**Who:** A product evaluator, investor, or potential collaborator who wants to understand the product depth before a meeting or decision.  
**Need:** See a realistic, complete trip — not a toy example. Understand all three core pillars: bookings, budget, AI chat.  
**Success:** Explores all three tabs of the Kura demo and uses the Chat AI at least once.

### 2.4 The Returning User *(v1 consideration only)*
**Who:** Already has a trip planned (like Narsing). Arrives at `/` expecting to go straight to their dashboard.  
**Need:** Not to be slowed down by a landing page they've already seen.  
**How we handle it in v1:** The Kura Europe tile is prominently above the fold. One click. In v2, auth will deep-link them directly to `/trip`.

---

## 3. User Journeys

### 3.1 Explorer Journey
```
Lands on /
  → Reads tagline (5 sec)
  → Sees Kura Europe tile with stats
  → Clicks "Explore this trip"
  → Lands on /trip (bookings dashboard)
  → Browses Itinerary tab
  → Opens Chat, asks a question
  → Returns to / via "← All trips" breadcrumb
  → Sees "Plan your trip" tile
  → Clicks → enters wizard (v2)
```

### 3.2 Planner Journey
```
Lands on /
  → Skips demo tile
  → Clicks "Plan your trip"
  → Wizard step 1: Destinations (where are you going?)
  → Wizard step 2: Dates (when?)
  → Wizard step 3: Travelers & budget
  → Confirmation screen → "Your trip is ready"
  → Lands on new (empty) trip dashboard
```

### 3.3 Demo Viewer Journey
```
Lands on /
  → Sees demo tile labeled clearly as "Demo trip"
  → Clicks "Explore this trip"
  → Full trip experience at /trip
  → Returns to / with "← All trips" breadcrumb
```

---

## 4. Page Structure

### 4.1 Route Changes

| Route | v0 (current) | v1 (this PRD) |
|---|---|---|
| `/` | Bookings dashboard (hardcoded trip) | **Landing page** (trip tiles) |
| `/trip` | Does not exist | **Bookings dashboard** (moved from `/`) |
| `/itinerary` | Unchanged | Unchanged |
| `/chat` | Unchanged | Unchanged |

### 4.2 Navigation Visibility

The top nav and mobile bottom tab bar are **hidden on `/`**. The landing page is a decision point, not a navigation shell. Navigation renders only when the user is inside a trip (`/trip`, `/itinerary`, `/chat`).

The Navigation component currently renders unconditionally in `layout.tsx`. This changes to a path-aware conditional: render nav only when `pathname !== "/"`.

### 4.3 Landing Page Layout (above the fold on all screen sizes)

```
┌────────────────────────────────────────────────┐
│                                                │
│   TripAI                          [top-left]   │
│                                                │
│   Plan smarter. Travel lighter.   [center-h]   │
│   Track bookings, manage budget,               │
│   and ask your AI travel assistant.            │
│                                                │
│   ┌──────────────────┐  ┌──────────────────┐  │
│   │ DEMO             │  │                  │  │
│   │ Kura Family      │  │  + Plan your     │  │
│   │ Europe 2026      │  │    trip          │  │
│   │                  │  │                  │  │
│   │ Jun 19 – Jul 5   │  │  Coming soon     │  │
│   │ 17 days          │  │                  │  │
│   │                  │  │                  │  │
│   │ London · Paris   │  │                  │  │
│   │ Interlaken · Milan│  │                  │  │
│   │                  │  │                  │  │
│   │ 4 travelers      │  │                  │  │
│   │ $9,405 locked in │  │                  │  │
│   │ 7/14 booked      │  │                  │  │
│   │                  │  │                  │  │
│   │ Explore trip →   │  │                  │  │
│   └──────────────────┘  └──────────────────┘  │
│                                                │
└────────────────────────────────────────────────┘
```

No scroll required on desktop to see both tiles. On mobile, tiles stack vertically — demo tile first.

---

## 5. Component Specifications

### 5.1 Page Header

**App name:** `TripAI` — left-aligned on desktop, centered on mobile. Same `font-mono` styling as current nav. Not a link (no circular navigation).

**Tagline (primary):** `Plan smarter. Travel lighter.`  
Short, active, benefit-led. Fits in one line on mobile.

**Tagline (secondary):** `Track bookings, manage budget, and ask your AI travel assistant.`  
One line on desktop, two on mobile. Covers the three core pillars without jargon. Color: `text-slate-500`.

**Spacing:** Generous top padding on desktop (`py-16`), compact on mobile (`py-10`). Landing page needs room to breathe — it's not a dashboard.

---

### 5.2 TripTile Component

A single reusable `TripTile` component handles both the demo tile and the "new trip" tile via a `variant` prop.

#### Props interface

```typescript
type TripTileProps =
  | {
      variant: "demo"
      trip: {
        name: string           // "Europe 2026"
        family: string         // "Kura Family"
        dateRange: string      // "Jun 19 – Jul 5"
        durationDays: number   // 17
        destinations: string[] // ["London", "Paris", "Interlaken", "Milan"]
        travelerCount: number  // 4
        lockedIn: number       // 9405
        bookedCount: number    // 7
        totalBookings: number  // 14
        href: string           // "/trip"
      }
    }
  | {
      variant: "new"
      comingSoon: boolean      // true for v1
    }
```

#### Demo tile anatomy (variant: "demo")

| Element | Content | Style |
|---|---|---|
| Badge | `DEMO` | `text-xs font-mono uppercase` · `bg-slate-100 text-slate-500` · top-left of card |
| Title | `Europe 2026` | `text-xl font-semibold text-slate-900` |
| Family | `Kura Family` | `text-sm text-slate-500` · below title |
| Date row | `Jun 19 – Jul 5  ·  17 days` | `text-sm text-slate-400 font-mono` |
| Destination chips | One chip per city | `text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full` · horizontal, wrapping |
| Divider | `<hr>` | `border-slate-100` |
| Stats row | `4 travelers  ·  $9,405 locked in  ·  7/14 booked` | `text-xs text-slate-400` · inline with `·` separator |
| CTA | `Explore this trip →` | `text-sm font-medium text-slate-900` · bottom of card · full-width on mobile |

The demo tile has a **visible border** (`border-slate-200`) and subtle hover state (`hover:border-slate-400 hover:shadow-sm`). No color splash, no image. The data is the signal.

#### New trip tile anatomy (variant: "new")

| Element | Content | Style |
|---|---|---|
| Icon | `+` | `text-2xl text-slate-300` · centered |
| Title | `Plan your trip` | `text-base font-medium text-slate-400` |
| Sub-copy | `Tell us your destinations, dates, and budget — we'll build the rest.` | `text-xs text-slate-400` · center-aligned |
| Status badge | `Coming soon` | `text-xs bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full` |

The new trip tile uses **dashed border** (`border-dashed border-slate-200`) to visually signal it's a placeholder/future action. Intentionally understated — the demo tile should draw the eye first.

In v2 (when wizard ships), `comingSoon: false` removes the badge and the tile becomes fully interactive with an `onClick` that opens the wizard.

---

### 5.3 Trip Creation Wizard (v1: behind "Coming soon" — spec for v2)

Chosen over a single form because trip planning has 3 logically distinct decisions (where, when, who/how much) that benefit from focus and progressive disclosure. A single form with 8 fields is intimidating. A wizard with 3 steps, 2–3 fields each, is not.

#### Step 1 — Destinations
**Prompt:** `Where are you going?`  
**Input:** Free-text destination chips (type city → press Enter or comma to add). Minimum 1, maximum 10.  
**Example:** `London` `Paris` `Interlaken` `Milan`  
**Skip:** Not allowed — destinations are required to scaffold the itinerary.

#### Step 2 — Dates
**Prompt:** `When are you traveling?`  
**Inputs:** Departure date + return date (two date pickers).  
**Validation:** Return must be after departure. Max 60-day trip in v1.  
**Helper text:** Shows computed trip duration live: `17 days`.

#### Step 3 — Travelers & Budget
**Prompt:** `Who's coming and what's your budget?`  
**Inputs:**  
- Number of travelers (stepper: 1–12)  
- Budget cap in USD (text input, numeric, optional — can skip with "I'll set this later")  
**Helper text for budget:** `This caps your booking tracker. You can change it anytime.`

#### Confirmation screen
Shows a summary card identical in design to the demo tile but with `NEW` badge instead of `DEMO`. One button: `Start planning →` — navigates to the new trip dashboard.

#### Wizard navigation
- `←` Back button on steps 2 and 3
- `Continue →` advances steps
- `✕` exits wizard, returns to landing page
- Progress indicator: `Step 1 of 3` in `text-xs text-slate-400`
- No sidebar, no progress bar — step number is sufficient at 3 steps

---

### 5.4 "Back to trips" breadcrumb

When a user is inside `/trip`, `/itinerary`, or `/chat`, a subtle `← All trips` link appears at the top-left of the inner navigation bar. This is the only path back to `/` from inside a trip — no nav tab required.

**Placement:** Left of the `TripAI` wordmark in the desktop nav. Hidden on mobile (too cramped — use browser back).  
**Style:** `text-xs text-slate-400 hover:text-slate-600` with a `←` arrow prefix.

---

## 6. Content Decisions

### 6.1 Tagline rationale

`Plan smarter. Travel lighter.` was chosen over alternatives because:

| Option | Rejected because |
|---|---|
| "AI-powered family trip planner" | Feature description, not a benefit. Reads like a subtitle. |
| "Your family trip, fully planned" | Passive. Doesn't communicate the AI angle. |
| "The trip planner that thinks with you" | Vague. "Thinks with you" is abstract. |
| **"Plan smarter. Travel lighter."** | ✓ Active verbs. Pairs planning effort (smart) with travel experience (light). Implies the app does the heavy lifting. |

### 6.2 Demo tile stats — where they come from

Stats on the demo tile are **fetched live** from the API at page load, same as the current dashboard. This means the demo tile reflects real booking progress (7/14, $9,405) rather than hardcoded numbers that go stale. If the API is unavailable, stats are hidden gracefully — the tile still renders with destinations and dates.

### 6.3 "Coming soon" copy on new trip tile

`Coming soon` was chosen over:
- `Sign up to get started` — implies email capture we're not building
- `Invite only` — implies exclusivity we haven't earned
- Hiding the tile entirely — hides the growth intent

Dashed border + muted text communicates "real feature, not built yet" without apology.

---

## 7. Technical Requirements

### 7.1 Route changes

| Change | File | Action |
|---|---|---|
| Move bookings dashboard | `app/page.tsx` → `app/trip/page.tsx` | Move file, update all internal `href="/"` to `href="/trip"` |
| New landing page | `app/page.tsx` | Create new file |
| New TripTile component | `components/TripTile.tsx` | Create new component |
| Conditional nav | `app/layout.tsx` | Wrap `<Navigation />` in path-aware conditional |
| Update nav home link | `components/Navigation.tsx` | Change `href: "/"` to `href: "/trip"` for Home tab; update `matchesPath` logic |
| Add back-to-trips link | `components/Navigation.tsx` | Add `← All trips` link to desktop nav pointing to `/` |

### 7.2 Navigation conditional rendering

`layout.tsx` is a Server Component and cannot use `usePathname`. The solution: extract a new `ConditionalNav` client component that reads the pathname and conditionally renders `<Navigation />`.

```
layout.tsx (Server)
  └─ ConditionalNav.tsx (Client — "use client")
       └─ Navigation.tsx (Client — already "use client")
```

`ConditionalNav` hides Navigation when `pathname === "/"`.

### 7.3 Demo tile data loading

The demo tile fetches `BookingSummary` on page load via `fetchBookings()`. If the fetch fails, the tile renders without stats — destinations and dates always render from static config. No loading spinner on the landing page — stats appear when ready or not at all.

### 7.4 TypeScript — no `any` types

`TripTile` uses a discriminated union prop type (shown in §5.2). No implicit `any`. Strict mode throughout.

### 7.5 No new API routes required for v1

The landing page reuses the existing `/trips/{id}/bookings` endpoint for summary stats. No backend changes.

---

## 8. Test Requirements

Following the project testing philosophy (TDD, tests before implementation):

### 8.1 Unit tests

| Test | File |
|---|---|
| `TripTile` renders demo variant with correct trip data | `__tests__/TripTile.test.tsx` |
| `TripTile` renders "Coming soon" badge when `comingSoon: true` | `__tests__/TripTile.test.tsx` |
| `TripTile` renders dashed border class on new variant | `__tests__/TripTile.test.tsx` |
| `ConditionalNav` hides navigation on `/` | `__tests__/ConditionalNav.test.tsx` |
| `ConditionalNav` shows navigation on `/trip` | `__tests__/ConditionalNav.test.tsx` |
| Landing page renders tagline copy correctly | `__tests__/LandingPage.test.tsx` |
| Landing page renders two tiles | `__tests__/LandingPage.test.tsx` |
| Landing page demo tile links to `/trip` | `__tests__/LandingPage.test.tsx` |

### 8.2 Integration test

| Test | File |
|---|---|
| GET `/` returns 200, page contains "Plan smarter" | `__tests__/landing.integration.test.tsx` |
| GET `/trip` returns 200, renders bookings dashboard | `__tests__/landing.integration.test.tsx` |

### 8.3 Not required for this PRD

No eval (no AI feature). No Playwright E2E in v1 — the interaction is simple navigation.

---

## 9. Success Metrics

| Metric | Target | How to measure |
|---|---|---|
| Time to first click on demo tile | < 10 seconds median | Client-side event (when analytics added) |
| Demo tile → Chat tab conversion | > 30% of demo tile visitors | Navigation event tracking |
| Landing page bounce rate | < 40% | Page exit without clicking either tile |
| "Back to trips" breadcrumb usage | Measurable (any usage) | Confirms the return path is discoverable |

*Note: v1 has no analytics instrumentation. These are baseline targets for when analytics ships.*

---

## 10. Open Questions

| # | Question | Owner | Status |
|---|---|---|---|
| 1 | When auth ships (Clerk), does `/` show a logged-in user's trip tiles automatically or always redirect to `/trip`? | Product | Open |
| 2 | Does the demo tile ever become read-only (prevent toggle of bookings)? Currently a visitor can mark bookings as done on the demo. | Product | **Recommend: lock demo tile in v1.1** |
| 3 | Wizard step 1 — should destination chips validate against a known city list or be free-form? | Engineering | Open — recommend free-form for v1 |
| 4 | What is the trip creation backend? Does wizard data persist before auth exists? | Engineering | Deferred to v2 (wizard is "coming soon" in v1) |

---

## 11. Out of Scope

- Email capture or waitlist form
- Social sharing of the Kura demo trip
- SEO meta tags and Open Graph data (useful but not blocking)
- Dark mode (project uses forced light mode throughout)
- Animations or page transitions
- Any change to `/itinerary` or `/chat` routes or their components

---

## 12. Phased Delivery

### v1 — Ship now (this PRD)
- New landing page at `/`
- Demo tile with live stats from API
- "Plan your trip" tile — dashed border, `Coming soon`
- Bookings dashboard moved to `/trip`
- Navigation hidden on `/`
- `← All trips` breadcrumb added inside trip nav
- All unit + integration tests passing

### v1.1 — Follow-on
- Lock demo tile — bookings not toggleable by visitors
- SEO metadata on landing page (`<title>`, `<meta description>`, Open Graph)

### v2 — After auth (Clerk)
- "Plan your trip" tile becomes active — opens wizard
- Trip creation wizard (3 steps: destinations → dates → travelers + budget)
- Logged-in users see their own trip tiles instead of demo
- Deep-link returning users directly to `/trip` bypassing landing page

---

*PRD complete. Ready to proceed when approved.*
