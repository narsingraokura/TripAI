/**
 * Tests for the Add Day flow in ItineraryPageClient.
 *
 * Covers: slot buttons, inline form, optimistic insert, rollback, and
 * GoalSuggestionCard appearance on validation result.
 */
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

// Mock DemoModeProvider so we can toggle demo mode per test.
const mockUseIsDemo = jest.fn(() => false)
jest.mock("@/components/DemoModeProvider", () => ({
  useIsDemo: () => mockUseIsDemo(),
}))

const NEW_DAY = {
  id: "day-new",
  trip_id: "trip-uuid",
  position: 2,
  date: "2026-06-20",
  city: "Paris",
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
  mockAddDay.mockResolvedValue(NEW_DAY)
  mockValidate.mockResolvedValue({ status: "ok", message: "Looks good." })
})

async function renderAndWait() {
  render(<ItineraryPageClient />)
  // Wait for the initial load to complete.
  await waitFor(() => expect(screen.getByText("London")).toBeInTheDocument())
}

it("shows Add Day buttons between cards and at the end when not in demo mode", async () => {
  await renderAndWait()
  // With 1 day there should be 2 slots: before and after.
  const buttons = screen.getAllByRole("button", { name: /add day/i })
  expect(buttons.length).toBeGreaterThanOrEqual(2)
})

it("hides Add Day buttons in demo mode", async () => {
  mockUseIsDemo.mockReturnValue(true)
  await renderAndWait()
  expect(screen.queryByRole("button", { name: /add day/i })).not.toBeInTheDocument()
})

it("clicking Add Day opens the inline form", async () => {
  await renderAndWait()
  const buttons = screen.getAllByRole("button", { name: /add day/i })
  await userEvent.click(buttons[0])
  expect(screen.getByRole("textbox", { name: /city/i })).toBeInTheDocument()
})

it("only one form is open at a time — opening a second slot closes the first", async () => {
  await renderAndWait()
  const buttons = screen.getAllByRole("button", { name: /add day/i })
  await userEvent.click(buttons[0])
  expect(screen.getAllByRole("textbox", { name: /city/i })).toHaveLength(1)
  await userEvent.click(buttons[1])
  // Still only one form visible.
  expect(screen.getAllByRole("textbox", { name: /city/i })).toHaveLength(1)
})

it("on successful add, the new day card appears", async () => {
  await renderAndWait()
  const [firstButton] = screen.getAllByRole("button", { name: /add day/i })
  await userEvent.click(firstButton)

  await userEvent.type(screen.getByRole("textbox", { name: /city/i }), "Paris")
  await userEvent.click(screen.getByRole("button", { name: /^add day$/i }))

  await waitFor(() => expect(screen.getByText("Paris")).toBeInTheDocument())
})

it("on API error, optimistic card is removed and no error text is shown", async () => {
  mockAddDay.mockRejectedValue(new Error("network fail"))
  await renderAndWait()

  const [firstButton] = screen.getAllByRole("button", { name: /add day/i })
  await userEvent.click(firstButton)

  await userEvent.type(screen.getByRole("textbox", { name: /city/i }), "Paris")
  await userEvent.click(screen.getByRole("button", { name: /^add day$/i }))

  await waitFor(() => {
    // Optimistic city card gone.
    expect(screen.queryByText("Paris")).not.toBeInTheDocument()
    // No error banners leaked into UI (error-state principle).
    expect(screen.queryByText(/failed/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/error/i)).not.toBeInTheDocument()
  })
})

it("shows GoalSuggestionCard when validation returns a result", async () => {
  mockValidate.mockResolvedValue({ status: "warning", message: "Consider the pace." })
  await renderAndWait()

  const [firstButton] = screen.getAllByRole("button", { name: /add day/i })
  await userEvent.click(firstButton)

  await userEvent.type(screen.getByRole("textbox", { name: /city/i }), "Paris")
  await userEvent.click(screen.getByRole("button", { name: /^add day$/i }))

  await waitFor(() =>
    expect(screen.getByText("Consider the pace.")).toBeInTheDocument()
  )
})

it("does not show GoalSuggestionCard when validation is not triggered", async () => {
  await renderAndWait()
  expect(screen.queryByText(/consider/i)).not.toBeInTheDocument()
})
