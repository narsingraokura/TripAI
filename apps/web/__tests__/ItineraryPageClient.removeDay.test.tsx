/**
 * Tests for the Remove Day flow in ItineraryPageClient.
 *
 * Covers: Remove button, confirmation dialog, optimistic removal, undo toast,
 * post-remove validation, SUGGEST-03 suggestions, and resolve wiring.
 *
 * NOTE: jest.mock factories are hoisted before const declarations, so the
 * day fixture data is inlined inside the factory. Constants below are used
 * only for test assertions.
 *
 * UndoToast is mocked here so we can control onExpire without real timers.
 * Internal timer behavior is tested in UndoToast.test.tsx.
 */
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const mockUseIsDemo = jest.fn(() => false)
jest.mock("@/components/DemoModeProvider", () => ({
  useIsDemo: () => mockUseIsDemo(),
}))

// Mock UndoToast so tests can trigger onExpire without a real 10s timer.
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

// Inline fixture data inside jest.mock factory (hoisting constraint).
jest.mock("@/lib/api", () => ({
  fetchItineraryFull: jest.fn().mockResolvedValue({
    days: [
      {
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
      },
      {
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
            id: "act-1",
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
      },
    ],
    goals: [],
    constraints: [],
  }),
  addItineraryDay: (...args: unknown[]) => mockAddDay(...args),
  removeItineraryDay: (...args: unknown[]) => mockRemoveDay(...args),
  validateItineraryMutation: (...args: unknown[]) => mockValidate(...args),
  resolveItineraryMutation: (...args: unknown[]) => mockResolve(...args),
  putTripGoals: jest.fn().mockResolvedValue([]),
  postTripConstraint: jest.fn().mockResolvedValue({}),
  deleteTripConstraint: jest.fn().mockResolvedValue(undefined),
}))

const user = userEvent.setup()

import ItineraryPageClient from "@/components/itinerary/ItineraryPageClient"

const PARIS_DAY_ID = "day-paris"
const ACTIVITY_ID = "act-1"
const LONDON_DAY_ID = "day-london"

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

beforeEach(() => {
  jest.clearAllMocks()
  mockUseIsDemo.mockReturnValue(false)
  mockRemoveDay.mockResolvedValue(undefined)
  mockValidate.mockResolvedValue({ status: "ok", message: "Looks fine.", suggestions: [] })
  mockResolve.mockResolvedValue({ days: [], goals: [], constraints: [] })
  mockAddDay.mockResolvedValue(LONDON_DAY_API)
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

// ── Remove button visibility ───────────────────────────────────────────────────

it("shows Remove button when a day card is expanded", async () => {
  await renderAndWait()
  await expandDay("Paris")
  expect(screen.getByRole("button", { name: /^remove$/i })).toBeInTheDocument()
})

it("hides Remove button in demo mode", async () => {
  mockUseIsDemo.mockReturnValue(true)
  await renderAndWait()
  await expandDay("Paris")
  expect(screen.queryByRole("button", { name: /^remove$/i })).not.toBeInTheDocument()
})

// ── Confirmation dialog ───────────────────────────────────────────────────────

it("clicking Remove opens the confirmation dialog with a Cancel button", async () => {
  await renderAndWait()
  await openRemoveDialog("Paris")
  const dialog = screen.getByRole("dialog")
  expect(within(dialog).getByRole("button", { name: /cancel/i })).toBeInTheDocument()
})

it("Cancel button closes the dialog without removing", async () => {
  await renderAndWait()
  await openRemoveDialog("Paris")
  const dialog = screen.getByRole("dialog")
  await user.click(within(dialog).getByRole("button", { name: /cancel/i }))
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  expect(mockRemoveDay).not.toHaveBeenCalled()
})

// ── Optimistic removal ────────────────────────────────────────────────────────

it("confirming remove calls removeItineraryDay with the day id", async () => {
  await renderAndWait()
  await confirmRemove("Paris")
  await waitFor(() => expect(mockRemoveDay).toHaveBeenCalledWith(PARIS_DAY_ID))
})

it("day is optimistically removed from the list after confirming", async () => {
  await renderAndWait()
  await confirmRemove("Paris")
  await waitFor(() => expect(screen.queryByText("Paris")).not.toBeInTheDocument())
})

// ── Undo toast ────────────────────────────────────────────────────────────────

it("undo toast appears after removal", async () => {
  await renderAndWait()
  await confirmRemove("Paris")
  await waitFor(() =>
    expect(screen.getByRole("button", { name: /undo/i })).toBeInTheDocument(),
  )
})

it("clicking Undo re-inserts the day and hides the toast", async () => {
  // mockAddDay must return Paris data so the setDays map doesn't erase it.
  mockAddDay.mockResolvedValueOnce({
    id: "day-paris",
    trip_id: "trip-uuid",
    position: 2,
    date: "2026-06-23",
    city: "Paris",
    day_type: "exploration",
    notes: null,
    created_at: "2026-04-24T00:00:00Z",
    updated_at: "2026-04-24T00:00:00Z",
    activities: [],
  })

  await renderAndWait()
  await confirmRemove("Paris")
  await waitFor(() =>
    expect(screen.getByRole("button", { name: /undo/i })).toBeInTheDocument(),
  )

  await user.click(screen.getByRole("button", { name: /undo/i }))

  await waitFor(() => {
    expect(screen.getByText("Paris")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /undo/i })).not.toBeInTheDocument()
  })
})

it("when toast expires, undo is no longer available and addItineraryDay is not called", async () => {
  await renderAndWait()
  await confirmRemove("Paris")
  await waitFor(() =>
    expect(screen.getByTestId("expire-undo-toast")).toBeInTheDocument(),
  )

  // Simulate timer expiry by clicking the mock's expire trigger.
  await user.click(screen.getByTestId("expire-undo-toast"))

  await waitFor(() => {
    expect(screen.queryByRole("button", { name: /undo/i })).not.toBeInTheDocument()
  })
  expect(mockAddDay).not.toHaveBeenCalled()
})

// ── Post-remove validation ────────────────────────────────────────────────────

it("shows GoalSuggestionCard after removal when validation returns a result", async () => {
  mockValidate.mockResolvedValue({
    status: "warning",
    message: "Check your pace.",
    suggestions: [],
  })
  await renderAndWait()
  await confirmRemove("Paris")
  await waitFor(() =>
    expect(screen.getByText("Check your pace.")).toBeInTheDocument(),
  )
})

// ── SUGGEST-03: resolution options ────────────────────────────────────────────

it("shows Apply buttons for violation suggestions", async () => {
  mockValidate.mockResolvedValue({
    status: "violation",
    message: "Must-visit constraint violated.",
    suggestions: [
      {
        suggestion_id: "s-1",
        label: "Move Eiffel Tower visit to London",
        description: "Relocate to London day.",
        payload: {
          action: "move_activity",
          activity_id: ACTIVITY_ID,
          from_day_id: PARIS_DAY_ID,
          to_day_id: LONDON_DAY_ID,
        },
      },
    ],
  })
  await renderAndWait()
  await confirmRemove("Paris")
  await waitFor(() =>
    expect(screen.getByRole("button", { name: /apply/i })).toBeInTheDocument(),
  )
})

it("clicking Apply calls resolveItineraryMutation with suggestion_id and payload", async () => {
  const suggestion = {
    suggestion_id: "s-1",
    label: "Move Eiffel Tower visit to London",
    description: "Relocate to London day.",
    payload: {
      action: "move_activity",
      activity_id: ACTIVITY_ID,
      from_day_id: PARIS_DAY_ID,
      to_day_id: LONDON_DAY_ID,
    },
  }
  mockValidate.mockResolvedValue({
    status: "violation",
    message: "Must-visit constraint violated.",
    suggestions: [suggestion],
  })
  await renderAndWait()
  await confirmRemove("Paris")

  await waitFor(() =>
    expect(screen.getByRole("button", { name: /apply/i })).toBeInTheDocument(),
  )
  await user.click(screen.getByRole("button", { name: /apply/i }))

  await waitFor(() =>
    expect(mockResolve).toHaveBeenCalledWith({
      suggestion_id: "s-1",
      suggestion_payload: suggestion.payload,
    }),
  )
})
