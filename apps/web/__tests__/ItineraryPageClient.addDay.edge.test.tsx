/**
 * Edge-case tests for the Add Day flow in ItineraryPageClient.
 *
 * Covers scenarios NOT in ItineraryPageClient.addDay.test.tsx:
 *   - Optimistic card appears in the DOM before the API call resolves
 *   - Validation failure degrades silently (no error state leaked to UI)
 */
import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ApiDay } from "@/lib/api"

const mockUseIsDemo = jest.fn(() => false)
jest.mock("@/components/DemoModeProvider", () => ({
  useIsDemo: () => mockUseIsDemo(),
}))

const NEW_DAY: ApiDay = {
  id: "day-new",
  trip_id: "trip-uuid",
  position: 2,
  date: "2026-06-20",
  city: "Rome",
  day_type: "exploration",
  notes: null,
  created_at: "2026-04-24T00:00:00Z",
  updated_at: "2026-04-24T00:00:00Z",
  activities: [],
}

const mockAddDay = jest.fn()
const mockValidate = jest.fn()

jest.mock("@/lib/api", () => ({
  fetchItineraryFull: jest.fn().mockResolvedValue({
    days: [
      {
        id: "day-1",
        trip_id: "trip-uuid",
        position: 1,
        date: "2026-06-19",
        city: "London",
        day_type: "exploration",
        notes: null,
        created_at: "2026-04-24T00:00:00Z",
        updated_at: "2026-04-24T00:00:00Z",
        activities: [],
      },
    ],
    goals: [],
    constraints: [],
  }),
  addItineraryDay: (...args: unknown[]) => mockAddDay(...args),
  validateItineraryMutation: (...args: unknown[]) => mockValidate(...args),
  putTripGoals: jest.fn().mockResolvedValue([]),
  postTripConstraint: jest.fn().mockResolvedValue({}),
  deleteTripConstraint: jest.fn().mockResolvedValue(undefined),
}))

import ItineraryPageClient from "@/components/itinerary/ItineraryPageClient"

beforeEach(() => {
  jest.clearAllMocks()
  mockUseIsDemo.mockReturnValue(false)
  mockValidate.mockResolvedValue({ status: "ok", message: "Looks good." })
})

async function renderAndWait() {
  render(<ItineraryPageClient />)
  await waitFor(() => expect(screen.getByText("London")).toBeInTheDocument())
}

it("optimistic card appears in the DOM before the API call resolves", async () => {
  // Use a manually-resolved promise so we can assert while the API is still pending.
  let resolveAdd!: (v: ApiDay) => void
  mockAddDay.mockImplementation(
    () => new Promise<ApiDay>((res) => { resolveAdd = res }),
  )

  await renderAndWait()
  const [firstButton] = screen.getAllByRole("button", { name: /add day/i })
  await userEvent.click(firstButton)
  await userEvent.type(screen.getByRole("textbox", { name: /city/i }), "Rome")

  // fireEvent.click submits the form and flushes the synchronous optimistic state update
  // without waiting for the pending addItineraryDay promise.
  fireEvent.click(screen.getByRole("button", { name: /^add day$/i }))

  // Optimistic card is visible immediately — API call is still pending at this point.
  expect(screen.getByText("Rome")).toBeInTheDocument()

  // Resolve to clean up the pending promise and avoid act() warnings.
  resolveAdd({ ...NEW_DAY, city: "Rome" })
  await waitFor(() => expect(mockAddDay).toHaveBeenCalledTimes(1))
})

it("validation failure is silent — no error state leaks into the UI", async () => {
  mockAddDay.mockResolvedValue(NEW_DAY)
  mockValidate.mockRejectedValue(new Error("validate network fail"))

  await renderAndWait()
  const [firstButton] = screen.getAllByRole("button", { name: /add day/i })
  await userEvent.click(firstButton)
  await userEvent.type(screen.getByRole("textbox", { name: /city/i }), "Rome")
  await userEvent.click(screen.getByRole("button", { name: /^add day$/i }))

  // Day is added successfully (API succeeded).
  await waitFor(() => expect(screen.getByText("Rome")).toBeInTheDocument())

  // Validation threw but no GoalSuggestionCard appears and no error text leaks out
  // (error-state principle: assert absence, not presence).
  await waitFor(() => {
    expect(screen.queryByText(/warning/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/violation/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/failed/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/error/i)).not.toBeInTheDocument()
  })
})
