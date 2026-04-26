/**
 * Edge-case and adversarial tests for the Remove Day flow in ItineraryPageClient.
 *
 * Covers scenarios the developer did not test:
 *   - API failure → optimistic rollback (day re-appears, undo toast hidden)
 *   - Validation API failure after remove is silent (no error text)
 *   - Single-day trip: remove → empty state → undo restores it
 *   - must_visit warning visible in dialog when constraint is active
 *
 * UndoToast and DemoModeProvider are mocked identically to the primary test file.
 */
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const mockUseIsDemo = jest.fn(() => false)
jest.mock("@/components/DemoModeProvider", () => ({
  useIsDemo: () => mockUseIsDemo(),
}))

jest.mock("@/components/UndoToast", () => ({
  __esModule: true,
  default: ({
    message,
    onUndo,
    onExpire,
  }: {
    message: string
    onUndo: () => void
    onExpire: () => void
  }) => (
    <div>
      <span>{message}</span>
      <button onClick={onUndo}>Undo</button>
      <button onClick={onExpire} data-testid="expire-undo-toast">
        Simulate expire
      </button>
    </div>
  ),
}))

const mockRemoveDay = jest.fn()
const mockValidate = jest.fn()
const mockResolve = jest.fn()
const mockAddDay = jest.fn()

// Two-day fixture — default for most tests
const PARIS_DAY_API = {
  id: "day-paris",
  trip_id: "trip-uuid",
  position: 2,
  date: "2026-06-23",
  city: "Paris",
  day_type: "exploration",
  notes: null,
  created_at: "2026-04-24T00:00:00Z",
  updated_at: "2026-04-24T00:00:00Z",
  activities: [
    {
      id: "act-eiffel",
      day_id: "day-paris",
      position: 1,
      title: "Eiffel Tower visit",
      time_slot: "morning",
      specific_time: null,
      category: "sightseeing",
      estimated_cost: 25,
      notes: null,
      created_at: "2026-04-24T00:00:00Z",
    },
  ],
}

const LONDON_DAY_API = {
  id: "day-london",
  trip_id: "trip-uuid",
  position: 1,
  date: "2026-06-20",
  city: "London",
  day_type: "exploration",
  notes: null,
  created_at: "2026-04-24T00:00:00Z",
  updated_at: "2026-04-24T00:00:00Z",
  activities: [],
}

// Single-day fixture — used for the last-day-removal test
const ONLY_DAY_API = {
  id: "day-only",
  trip_id: "trip-uuid",
  position: 1,
  date: "2026-06-20",
  city: "Amsterdam",
  day_type: "exploration",
  notes: null,
  created_at: "2026-04-24T00:00:00Z",
  updated_at: "2026-04-24T00:00:00Z",
  activities: [],
}

jest.mock("@/lib/api", () => ({
  fetchItineraryFull: jest.fn(),
  addItineraryDay: (...args: unknown[]) => mockAddDay(...args),
  removeItineraryDay: (...args: unknown[]) => mockRemoveDay(...args),
  validateItineraryMutation: (...args: unknown[]) => mockValidate(...args),
  resolveItineraryMutation: (...args: unknown[]) => mockResolve(...args),
  putTripGoals: jest.fn().mockResolvedValue([]),
  postTripConstraint: jest.fn().mockResolvedValue({}),
  deleteTripConstraint: jest.fn().mockResolvedValue(undefined),
}))

const { fetchItineraryFull } = jest.requireMock("@/lib/api")

const user = userEvent.setup()

import ItineraryPageClient from "@/components/itinerary/ItineraryPageClient"

beforeEach(() => {
  jest.clearAllMocks()
  mockUseIsDemo.mockReturnValue(false)
  mockRemoveDay.mockResolvedValue(undefined)
  mockValidate.mockResolvedValue({ status: "ok", message: "Looks fine.", suggestions: [] })
  mockResolve.mockResolvedValue({ days: [], goals: [], constraints: [] })
  mockAddDay.mockResolvedValue(LONDON_DAY_API)

  // Default: two-day itinerary
  ;(fetchItineraryFull as jest.Mock).mockResolvedValue({
    days: [LONDON_DAY_API, PARIS_DAY_API],
    goals: [],
    constraints: [],
  })
})

async function renderAndWait() {
  render(<ItineraryPageClient />)
  await waitFor(() => expect(screen.getByText("London")).toBeInTheDocument())
}

async function expandDay(cityName: string) {
  await user.click(screen.getByText(cityName))
}

async function openRemoveDialog(cityName: string) {
  await expandDay(cityName)
  await user.click(screen.getByRole("button", { name: /^remove$/i }))
}

async function confirmRemove(cityName: string) {
  await openRemoveDialog(cityName)
  const dialog = screen.getByRole("dialog")
  await user.click(within(dialog).getByRole("button", { name: /remove/i }))
}

// ── Optimistic rollback on API failure ────────────────────────────────────────

it("re-inserts day and hides undo toast when API call fails", async () => {
  mockRemoveDay.mockRejectedValueOnce(new Error("network error"))

  await renderAndWait()
  await confirmRemove("Paris")

  // Final state: Paris back, undo toast gone, no error text visible
  await waitFor(() => {
    expect(screen.getByText("Paris")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /undo/i })).not.toBeInTheDocument()
  })
})

it("does not show validation card after API failure (validate is never called)", async () => {
  mockRemoveDay.mockRejectedValueOnce(new Error("network error"))

  await renderAndWait()
  await confirmRemove("Paris")

  // Rollback returns early before validate is called
  await waitFor(() => expect(screen.getByText("Paris")).toBeInTheDocument())
  expect(mockValidate).not.toHaveBeenCalled()
  // "Looks fine." is what the GoalSuggestionCard would show if validate had succeeded
  expect(screen.queryByText("Looks fine.")).not.toBeInTheDocument()
})

// ── Validation failure is silent ──────────────────────────────────────────────

it("no error text shown when validation API call fails after remove", async () => {
  mockValidate.mockRejectedValueOnce(new Error("validation service unavailable"))

  await renderAndWait()
  await confirmRemove("Paris")

  // Day is removed (optimistic)
  await waitFor(() => expect(screen.queryByText("Paris")).not.toBeInTheDocument())

  // Validation failure must be silent — GoalSuggestionCard must not appear.
  // "Looks fine." is the message the mock would return if validate *succeeded*,
  // so its absence confirms the validation result was never applied to state.
  await waitFor(() => {
    expect(screen.queryByText("Looks fine.")).not.toBeInTheDocument()
    expect(screen.queryByText(/validation service unavailable/i)).not.toBeInTheDocument()
  })
})

// ── Last day removal ──────────────────────────────────────────────────────────

it("shows empty state after removing the only day in the itinerary", async () => {
  ;(fetchItineraryFull as jest.Mock).mockResolvedValueOnce({
    days: [ONLY_DAY_API],
    goals: [],
    constraints: [],
  })

  render(<ItineraryPageClient />)
  await waitFor(() => expect(screen.getByText("Amsterdam")).toBeInTheDocument())

  await confirmRemove("Amsterdam")

  await waitFor(() =>
    expect(screen.getByText(/no days planned yet/i)).toBeInTheDocument(),
  )
  expect(screen.queryByText("Amsterdam")).not.toBeInTheDocument()
})

it("undo after last-day removal restores day and clears empty state", async () => {
  ;(fetchItineraryFull as jest.Mock).mockResolvedValueOnce({
    days: [ONLY_DAY_API],
    goals: [],
    constraints: [],
  })
  mockAddDay.mockResolvedValueOnce({
    ...ONLY_DAY_API,
    id: "day-only-restored",
  })

  render(<ItineraryPageClient />)
  await waitFor(() => expect(screen.getByText("Amsterdam")).toBeInTheDocument())

  await confirmRemove("Amsterdam")
  await waitFor(() =>
    expect(screen.getByText(/no days planned yet/i)).toBeInTheDocument(),
  )

  // Undo
  await user.click(screen.getByRole("button", { name: /undo/i }))

  await waitFor(() => {
    expect(screen.getByText("Amsterdam")).toBeInTheDocument()
    expect(screen.queryByText(/no days planned yet/i)).not.toBeInTheDocument()
  })
})

// ── must_visit warning in dialog ──────────────────────────────────────────────

it("RemoveDayDialog shows non-negotiable warning when day has a must_visit activity", async () => {
  ;(fetchItineraryFull as jest.Mock).mockResolvedValueOnce({
    days: [LONDON_DAY_API, PARIS_DAY_API],
    goals: [],
    constraints: [
      {
        id: "con-1",
        trip_id: "trip-uuid",
        constraint_type: "must_visit",
        description: "Eiffel Tower visit",
        value: null,
        created_at: "2026-04-24T00:00:00Z",
      },
    ],
  })

  render(<ItineraryPageClient />)
  await waitFor(() => expect(screen.getByText("Paris")).toBeInTheDocument())

  await openRemoveDialog("Paris")

  const dialog = screen.getByRole("dialog")
  expect(within(dialog).getByText(/non-negotiable/i)).toBeInTheDocument()
  expect(within(dialog).getByText(/eiffel tower visit/i)).toBeInTheDocument()
})

it("RemoveDayDialog shows no warning when day activities do not match any must_visit constraint", async () => {
  ;(fetchItineraryFull as jest.Mock).mockResolvedValueOnce({
    days: [LONDON_DAY_API, PARIS_DAY_API],
    goals: [],
    constraints: [
      {
        id: "con-2",
        trip_id: "trip-uuid",
        constraint_type: "must_visit",
        description: "Colosseum tour",  // Does not match Paris activities
        value: null,
        created_at: "2026-04-24T00:00:00Z",
      },
    ],
  })

  render(<ItineraryPageClient />)
  await waitFor(() => expect(screen.getByText("Paris")).toBeInTheDocument())

  await openRemoveDialog("Paris")

  const dialog = screen.getByRole("dialog")
  expect(within(dialog).queryByText(/non-negotiable/i)).not.toBeInTheDocument()
})
