# Skill: Itinerary Editor

Domain knowledge for stories that touch the itinerary feature.
Read `tripai-conventions.md` first, then this file.

---

## The 17 days (Kura Europe 2026)

| date    | city        | country | intensity | notes |
|---------|-------------|---------|-----------|-------|
| Jun 20  | London      | UK      | light     | Arrive LHR, jet lag buffer |
| Jun 21  | London      | UK      | moderate  | London Bridge, Borough Market, South Bank |
| Jun 22  | London      | UK      | busy      | Westminster, Big Ben, Natural History Museum |
| Jun 23  | Paris       | France  | travel    | Eurostar morning, arrive Paris, Marais |
| Jun 24  | Paris       | France  | busy      | Eiffel Tower, Champ de Mars, Seine |
| Jun 25  | Paris       | France  | busy      | Louvre 9am, Musée d'Orsay afternoon |
| Jun 26  | Paris       | France  | special   | Anniversary — Montmartre, dinner at Septime |
| Jun 27  | Interlaken  | CH      | travel    | Birthday — TGV Paris→Basel→Interlaken |
| Jun 28  | Interlaken  | CH      | light     | Lake Brienz boat, rest |
| Jun 29  | Interlaken  | CH      | busy      | Titlis mountain day (Engelberg) |
| Jun 30  | Interlaken  | CH      | light     | Grindelwald, flex day |
| Jul 1   | Interlaken  | CH      | busy      | Skydiving — parents only |
| Jul 2   | Milan       | Italy   | travel    | Train Interlaken→Milan, Navigli evening |
| Jul 3   | Milan       | Italy   | moderate  | Duomo rooftop, Brera, Last Supper optional |
| Jul 4   | Milan       | Italy   | light     | Flex day, pack |
| Jul 5   | (transit)   | —       | travel    | Depart MXP→SFO |

`Intensity` type: `"light" | "moderate" | "busy" | "travel" | "special"`

---

## TypeScript types (from `apps/web/lib/api.ts`)

```typescript
export type Intensity = "light" | "moderate" | "busy" | "travel" | "special"

export type ItineraryDay = {
  id: string
  trip_id: string
  date: string         // "YYYY-MM-DD"
  city: string | null
  country: string | null
  title: string
  plan: string
  intensity: Intensity
  is_special: boolean
  special_label: string | null
}

export type ItineraryDayPatch = {
  title?: string
  plan?: string
  intensity?: Intensity
}

export type ItineraryDayCreate = {
  date: string
  city: string
  country: string
  title: string
  plan?: string
  intensity?: Intensity
}

export type Suggestion = {
  title: string
  description: string
  why_fits: string
  cost_delta: number
  intensity: "light" | "moderate" | "busy"
  booking_required: boolean
}
```

---

## API functions (from `apps/web/lib/api.ts`)

```typescript
// Reads all itinerary days for the trip
fetchItinerary(): Promise<ItineraryDay[]>

// Updates title, plan, and/or intensity for a day — guarded (sends X-API-Key)
patchItineraryDay(date: string, patch: ItineraryDayPatch): Promise<ItineraryDay | null>

// Creates a new day — guarded (sends X-API-Key)
createItineraryDay(data: ItineraryDayCreate): Promise<ItineraryDay>

// Deletes a day by date — guarded (sends X-API-Key)
deleteItineraryDay(date: string): Promise<void>

// Fetches 3 AI-generated alternatives for a day — guarded (sends X-API-Key)
fetchSuggestions(date: string): Promise<Suggestion[]>
```

---

## Backend routes (from `apps/api/main.py`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/trips/{trip_id}/itinerary` | none | Returns all days sorted by date |
| GET | `/trips/{trip_id}/itinerary/{date}` | none | Returns one day |
| PATCH | `/trips/{trip_id}/itinerary/{date}` | `X-API-Key` | Updates title/plan/intensity |
| POST | `/trips/{trip_id}/itinerary` | `X-API-Key` | Creates a new day (201) |
| DELETE | `/trips/{trip_id}/itinerary/{date}` | `X-API-Key` | Deletes a day |
| POST | `/trips/{trip_id}/itinerary/{date}/suggest` | `X-API-Key` | Returns 3 AI suggestions |

**Pydantic models:**

```python
class ItineraryDayCreate(BaseModel):
    date: str
    city: str
    country: str
    title: str
    plan: str = ""
    intensity: str = "moderate"

class ItineraryDayUpdate(BaseModel):
    title: str | None = None
    plan: str | None = None
    intensity: str | None = None
```

---

## Component tree

```
apps/web/app/itinerary/page.tsx          ← page; composes ItineraryView
apps/web/components/itinerary/
  ItineraryView.tsx                      ← manages all editor state
  CityGroup.tsx                          ← groups DayCards by city
  DayCard.tsx                            ← expand/collapse, edit, suggest, delete
  DayEditor.tsx                          ← inline title/plan/intensity form
  SuggestionPanel.tsx                    ← shows 3 AI suggestion cards
  SuggestionCard.tsx                     ← one suggestion with "Apply" button
  IntensityBadge.tsx                     ← colored badge for intensity level
  AddDayForm.tsx                         ← form for creating a new day
```

---

## DayCard props (`apps/web/components/itinerary/DayCard.tsx`)

```typescript
type DayCardProps = {
  day: ItineraryDay
  isExpanded: boolean
  isEditing: boolean
  draft: { title: string; plan: string; intensity: Intensity } | null
  saving: boolean
  saveError: string | null
  suggestLoading: boolean
  suggestions: Suggestion[] | null
  suggestError: string | null
  onToggleExpand: () => void
  onStartEdit: () => void
  onDraftChange: (field: "title" | "plan" | "intensity", value: string) => void
  onSave: () => void
  onCancel: () => void
  onSuggest: () => void
  onSelectSuggestion: (s: Suggestion) => void
  onDelete: () => void
}
```

DayCard uses `useIsDemo()` from `DemoModeProvider` — edit/delete/suggest buttons are
hidden in demo mode. Do not remove this guard.

---

## DayEditor props (`apps/web/components/itinerary/DayEditor.tsx`)

```typescript
type DayEditorProps = {
  title: string
  plan: string
  intensity: Intensity
  saving: boolean
  saveError: string | null
  onChange: (field: "title" | "plan" | "intensity", value: string) => void
  onSave: () => void
  onCancel: () => void
}
```

---

## CityGroup props (`apps/web/components/itinerary/CityGroup.tsx`)

```typescript
type CityGroupProps = {
  city: string
  days: ItineraryDay[]
  expandedDate: string | null
  editingDate: string | null
  draft: { title: string; plan: string; intensity: Intensity } | null
  saving: boolean
  saveError: string | null
  suggestingDate: string | null
  suggestLoading: boolean
  suggestions: Suggestion[] | null
  suggestError: string | null
  onToggleExpand: (date: string) => void
  onStartEdit: (date: string) => void
  onDraftChange: (field: "title" | "plan" | "intensity", value: string) => void
  onSave: () => void
  onCancel: () => void
  onSuggest: (date: string) => void
  onSelectSuggestion: (s: Suggestion) => void
  onDelete: (date: string) => void
}
```

All editor state is lifted to `ItineraryView` — `CityGroup` and `DayCard` are
stateless. New itinerary stories should follow this pattern.

---

## AI suggestions engine

Route: `POST /trips/{trip_id}/itinerary/{date}/suggest`

The backend:
1. Fetches the current day and all bookings for the trip
2. Builds a prompt with the day's plan and budget context
3. Calls Claude (`claude-sonnet-4-6`) and expects exactly 3 structured suggestions
4. Returns a `SuggestResponse` with `{ date, city, suggestions: Suggestion[] }`

Each `Suggestion` has: `title`, `description`, `why_fits`, `cost_delta` (can be negative),
`intensity` (`"light" | "moderate" | "busy"`), `booking_required`.

The frontend calls `fetchSuggestions(date)` and passes results to `SuggestionPanel`.
Applying a suggestion calls `onSelectSuggestion(s)` which triggers a `patchItineraryDay`.

---

## State management pattern in ItineraryView

All interactive state lives in `ItineraryView`. Key state variables:
- `expandedDate: string | null` — which day card is open
- `editingDate: string | null` — which day is in edit mode
- `draft: { title, plan, intensity } | null` — current edit buffer
- `suggestingDate: string | null` — which day's suggestions are showing
- `suggestions: Suggestion[] | null` — current suggestion set

Only one day can be expanded at a time; only one can be in edit mode at a time.
Opening the editor automatically expands the card.

---

## Demo mode

`DemoModeProvider` wraps the app. In demo mode (`useIsDemo()` returns `true`):
- Edit, Delete, and "Suggest alternatives" buttons are hidden in `DayCard`
- The `DemoBanner` component is shown at the top of the page

New itinerary components must respect demo mode — check `useIsDemo()` before
rendering any write-action UI.

---

## Tests to look at for patterns

- `apps/api/tests/test_itinerary.py` — 38 backend tests covering CRUD + suggestions
- `apps/web/__tests__/DayCard.test.tsx` — component unit tests
- `apps/web/__tests__/DayEditor.test.tsx` — form interaction tests
- `apps/web/__tests__/CityGroup.test.tsx` — state delegation tests
