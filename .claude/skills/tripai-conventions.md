# Skill: TripAI Conventions

Domain knowledge for agents working across any part of the TripAI codebase.
Read this before starting any story.

---

## Multi-tenancy — the trip_id rule

Every database query MUST filter by `trip_id`. There is no exception.

**Pattern (Python/Supabase):**
```python
result = supabase.table("itinerary_days").select("*").eq("trip_id", trip_id).execute()
```

The `trip_id` comes from the URL path parameter. Routes follow the pattern:
`/trips/{trip_id}/[resource]`

**Pattern (TypeScript/frontend):**
The frontend never calls Supabase directly. It calls the FastAPI backend via `lib/api.ts`.
`getTripId()` in `lib/api.ts` reads `process.env.NEXT_PUBLIC_TRIP_ID` at runtime.

---

## Auth guard — X-API-Key header

Write endpoints are protected by `Depends(require_admin_key)` in `main.py`.
Every `fetch` call in `lib/api.ts` targeting a guarded route must send:
```typescript
headers: { "Content-Type": "application/json", "X-API-Key": getAdminApiKey() }
```

`getAdminApiKey()` reads `process.env.NEXT_PUBLIC_ADMIN_API_KEY`.

Currently guarded routes (checked 2026-04-23):
- `PATCH /trips/{trip_id}/bookings/{booking_id}`
- `PATCH /trips/{trip_id}/itinerary/{date}`
- `POST /trips/{trip_id}/itinerary/{date}/suggest`
- `POST /trips/{trip_id}/itinerary`
- `DELETE /trips/{trip_id}/itinerary/{date}`
- `POST /trips/{trip_id}/chat/index`

When you add a new guarded route, also add the `X-API-Key` header to its caller in `lib/api.ts`.

---

## Adding a FastAPI route

1. Add the Pydantic model(s) in `main.py` (near the other models at the top)
2. Add the route handler function with the `@app.[method]` decorator
3. For write routes, add `_auth: None = Depends(require_admin_key)` as a parameter
4. Always validate the trip exists first:
```python
trip_result = supabase.table("trips").select("id").eq("id", trip_id).execute()
if not trip_result.data:
    raise HTTPException(status_code=404, detail=f"Trip {trip_id} not found")
```
5. Write the test in `apps/api/tests/test_[resource].py`

**Route signature pattern:**
```python
@app.post("/trips/{trip_id}/itinerary", response_model=ItineraryDay, status_code=201)
def create_itinerary_day(
    trip_id: str,
    body: ItineraryDayCreate,
    supabase: Client = Depends(get_supabase),
    _auth: None = Depends(require_admin_key),
) -> ItineraryDay:
```

FastAPI `Header(None)`, `Query(None)`, `Body(None)` params must be typed `str | None`, not `str`.

---

## Adding a frontend API function

All API calls live in `apps/web/lib/api.ts`. Pattern:

```typescript
export async function myNewCall(arg: string): Promise<MyType> {
  const res = await fetch(
    `${getApiBase()}/trips/${getTripId()}/resource/${arg}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": getAdminApiKey() },
      body: JSON.stringify({ field: value }),
    },
  )
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json() as Promise<MyType>
}
```

Export the TypeScript types at the top of the same file. No `any` types.

---

## Adding a Next.js page

- Pages live in `apps/web/app/[route]/page.tsx`
- Pages are server components by default — mark client components `"use client"`
- No business logic in `page.tsx` — pages only compose components
- Components live in `apps/web/components/` (one file per component)
- Itinerary-specific components live in `apps/web/components/itinerary/`
- shadcn/ui components live in `apps/web/components/ui/` — never edit these directly

---

## Backend testing patterns

Test file location: `apps/api/tests/test_[resource].py`

**Fixtures (from `tests/conftest.py`):**
```python
# trip_id fixture — reads from os.environ at call time
@pytest.fixture
def trip_id() -> str:
    return os.environ["TRIP_ID"]

# supabase_mock fixture — patches the Supabase client
```

Never hardcode the trip_id string in tests — always use the `trip_id` fixture.
Never hardcode expected values that duplicate fixture constants — read from `os.environ`.

**Mocking Supabase in unit tests:**
```python
def test_something(client, mocker):
    mock_sb = mocker.patch("main.get_supabase")
    mock_sb.return_value.table.return_value.select.return_value... = MagicMock()
```

When testing a 403 auth guard, mock Supabase so the guard (403) is distinguishable from a
downstream failure (500). The guard must be the discriminating factor.

**Running tests:**
```bash
cd apps/api && pytest tests/ -v          # all tests
cd apps/api && pytest tests/test_itinerary.py -v   # one file
```
Use absolute paths — relative paths fail when the shell cwd is wrong.

---

## Frontend testing patterns

Test file location: `apps/web/__tests__/ComponentName.test.tsx`

**Stack:** Jest + React Testing Library

```typescript
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import MyComponent from "@/components/MyComponent"

it("renders correctly", () => {
  render(<MyComponent prop="value" />)
  expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument()
})
```

`TextDecoder` is NOT available in Jest's jsdom environment. To test async generators
that use `TextDecoder` (e.g. SSE stream parsers), mock `fetch` to return `{ ok: false }`
so the generator throws before reaching `TextDecoder`.

Error-state tests assert the ABSENCE of artifacts:
```typescript
// Correct: assert loading spinner goes away after error
await waitFor(() => {
  expect(screen.queryByText(/loading/i)).not.toBeInTheDocument()
})
```
## Anti-Patterns (learned from bugs)

- **Deferred-delete:** Never defer an API delete to a timer. The call is lost
  on component unmount/navigation. Use immediate-delete + create-on-undo instead.
  Reference: CHORE-BOOKING-EDIT navigate-away bug.
- **Supabase upsert for replace-all:** Supabase upsert inserts/updates but does
  NOT delete rows absent from the input. For replace-all semantics, use
  delete-all-then-insert. Reference: EDIT-01 goal reappearing after remove.
- **Silent error handling:** Never swallow mutation failures. Every catch block
  that rolls back state must ALSO set an error message the user can see.
  Reference: EDIT-01 BUG-EDIT01-001.

## Undo Pattern (canonical)

The approved undo pattern for all delete operations:
1. Call delete API immediately on confirm
2. Remove item from UI optimistically
3. Show UndoToast (purely cosmetic — no deferred API call)
4. On undo click: call create API to re-insert the item
5. On undo failure: show error message, item stays deleted
6. On toast expiry: clear undo state (no API call needed)

## Frontend Test Patterns

- **UndoToast mock:** Mock UndoToast with a data-testid="expire-btn" to
  trigger onExpire without real timers. This is the standard pattern used
  in 3+ test files.
- **Async race testing:** Use a deferred promise + act() flush to test
  interleaved timing (e.g., undo before validation resolves). Without act(),
  React doesn't flush the stale setState and the test gives false green.
- **Cost button disambiguation:** Use getAllByRole("button", { name: /^\$/ })
  then filter by text content — avoids ambiguity with stat-card <p> elements.
- **Formula assertions:** Always assert numerical results as formulas:
  assert remaining == BUDGET_CAP - locked_in (not assert remaining == 24620).
  Include a negative assertion confirming the wrong formula fails.

Running tests:
```bash
cd apps/web && npm test                         # watch mode
cd apps/web && npm test -- --watchAll=false     # CI mode
cd apps/web && npm run test:integration         # integration tests (needs both servers)
```

---

## Numerical test assertions

When a test asserts a derived value (totals, percentages, averages), assert the formula:

```python
# Wrong — passes when formula is wrong but data coincidentally matches
assert summary["remaining"] == 6020.00

# Correct — asserts the relationship
assert summary["remaining"] == pytest.approx(BUDGET_CAP - summary["locked_in"])
```

---

## Commit conventions

Format: `type(scope): description`

Types: `feat`, `fix`, `test`, `refactor`, `docs`, `chore`
Scope: feature area (e.g. `itinerary`, `booking`, `chat`, `rag`)

Examples:
- `feat(itinerary): add DELETE /itinerary/{date} route`
- `test(itinerary): add edge case tests for missing trip_id`
- `fix(web): send X-API-Key header on patchItineraryDay`

One concern per commit. If the message contains "and", split the commit.

---

## Environment variables

| Variable | Where set | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Vercel (build-time) | FastAPI base URL |
| `NEXT_PUBLIC_TRIP_ID` | Vercel (build-time) | Kura Europe 2026 trip UUID |
| `NEXT_PUBLIC_ADMIN_API_KEY` | Vercel (build-time) | Auth header for write endpoints |
| `SUPABASE_URL` | Railway (runtime) | Supabase project URL |
| `SUPABASE_KEY` | Railway (runtime) | Supabase service role key |
| `ANTHROPIC_API_KEY` | Railway (runtime) | Claude API key |
| `OPENAI_API_KEY` | Railway (runtime) | Embeddings key |
| `QDRANT_URL` | Railway (runtime) | Qdrant Cloud URL |
| `QDRANT_API_KEY` | Railway (runtime) | Qdrant API key |
| `ADMIN_API_KEY` | Railway (runtime) | Backend auth key (must match frontend) |

`NEXT_PUBLIC_*` vars are baked into the browser bundle at build time. Never put secrets
in them — they are visible to any visitor.
