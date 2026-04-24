/**
 * Edge-case and adversarial tests for ItineraryPageClient — EDIT-01
 * Written by Tester. DO NOT edit source code; only report bugs.
 */

import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import ItineraryPageClient from "@/components/itinerary/ItineraryPageClient"
import type { ApiConstraint, ApiDay, ApiGoal, ApiItinerary } from "@/lib/api"
import {
  deleteTripConstraint,
  fetchItineraryFull,
  postTripConstraint,
  putTripGoals,
} from "@/lib/api"

// ── Mocks ──────────────────────────────────────────────────────────────────────

jest.mock("@/lib/api", () => ({
  fetchItineraryFull: jest.fn(),
  putTripGoals: jest.fn(),
  postTripConstraint: jest.fn(),
  deleteTripConstraint: jest.fn(),
}))

const mockFetchItineraryFull = fetchItineraryFull as jest.MockedFunction<
  typeof fetchItineraryFull
>
const mockPutTripGoals = putTripGoals as jest.MockedFunction<typeof putTripGoals>
const mockPostTripConstraint = postTripConstraint as jest.MockedFunction<
  typeof postTripConstraint
>
const mockDeleteTripConstraint = deleteTripConstraint as jest.MockedFunction<
  typeof deleteTripConstraint
>

// ── Fixtures ───────────────────────────────────────────────────────────────────

function makeDay(i: number, city: string | null, date: string): ApiDay {
  return {
    id: `day-${i}`,
    trip_id: "trip-1",
    position: i,
    date,
    city,
    day_type: "exploration" as const,
    notes: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    activities: [],
  }
}

// Kura Europe 2026 — all 17 itinerary days (CLAUDE.md is authoritative)
const SEVENTEEN_DAYS: ApiDay[] = [
  makeDay(1, "London", "2026-06-20"),
  makeDay(2, "London", "2026-06-21"),
  makeDay(3, "London", "2026-06-22"),
  makeDay(4, "Paris", "2026-06-23"),
  makeDay(5, "Paris", "2026-06-24"),
  makeDay(6, "Paris", "2026-06-25"),
  makeDay(7, "Paris", "2026-06-26"),
  makeDay(8, "Interlaken", "2026-06-27"),
  makeDay(9, "Interlaken", "2026-06-28"),
  makeDay(10, "Interlaken", "2026-06-29"),
  makeDay(11, "Interlaken", "2026-06-30"),
  makeDay(12, "Interlaken", "2026-07-01"),
  makeDay(13, "Milan", "2026-07-02"),
  makeDay(14, "Milan", "2026-07-03"),
  makeDay(15, "Milan", "2026-07-04"),
  makeDay(16, null, "2026-07-05"), // transit day — null city maps to "Transit"
  makeDay(17, null, "2026-07-06"), // extra transit day to reach 17
]

const DAY_WITH_ACTIVITIES: ApiDay = {
  id: "day-cost",
  trip_id: "trip-1",
  position: 1,
  date: "2026-06-20",
  city: "London",
  day_type: "exploration" as const,
  notes: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  activities: [
    {
      id: "act-1",
      day_id: "day-cost",
      position: 1,
      title: "Borough Market",
      time_slot: "morning" as const,
      specific_time: null,
      category: "food" as const,
      estimated_cost: 50,
      notes: null,
      created_at: "2026-01-01T00:00:00Z",
    },
    {
      id: "act-2",
      day_id: "day-cost",
      position: 2,
      title: "Tower Bridge",
      time_slot: "afternoon" as const,
      specific_time: null,
      category: "sightseeing" as const,
      estimated_cost: 30,
      notes: null,
      created_at: "2026-01-01T00:00:00Z",
    },
  ],
}

const DAY_WITH_NULL_COST: ApiDay = {
  ...DAY_WITH_ACTIVITIES,
  id: "day-nullcost",
  activities: [
    {
      ...DAY_WITH_ACTIVITIES.activities[0],
      id: "act-null",
      day_id: "day-nullcost",
      estimated_cost: null,
    },
  ],
}

const CULTURAL_GOAL: ApiGoal = {
  id: "goal-1",
  trip_id: "trip-1",
  goal_type: "preset" as const,
  label: "Cultural experiences",
  created_at: "2026-01-01T00:00:00Z",
}

const BUDGET_CONSTRAINT: ApiConstraint = {
  id: "con-1",
  trip_id: "trip-1",
  constraint_type: "budget_cap" as const,
  description: "Max $5000 for hotels",
  value: 5000,
  created_at: "2026-01-01T00:00:00Z",
}

const NO_GOALS_ITINERARY: ApiItinerary = {
  days: [makeDay(1, "London", "2026-06-20")],
  goals: [],
  constraints: [],
}

const WITH_GOALS_ITINERARY: ApiItinerary = {
  days: [makeDay(1, "London", "2026-06-20")],
  goals: [CULTURAL_GOAL],
  constraints: [],
}

const WITH_CONSTRAINT_ITINERARY: ApiItinerary = {
  days: [makeDay(1, "London", "2026-06-20")],
  goals: [CULTURAL_GOAL],
  constraints: [BUDGET_CONSTRAINT],
}

beforeEach(() => {
  jest.clearAllMocks()
})

// ── 17-day rendering ───────────────────────────────────────────────────────────

describe("17-day rendering", () => {
  it("renders one card per day when all 17 days are returned", async () => {
    mockFetchItineraryFull.mockResolvedValue({
      days: SEVENTEEN_DAYS,
      goals: [],
      constraints: [],
    })
    render(<ItineraryPageClient />)
    // Each card shows "Day N" in its header
    for (let i = 1; i <= 17; i++) {
      expect(await screen.findByText(`Day ${i}`)).toBeInTheDocument()
    }
  })

  it("transit day with null city renders as 'Transit'", async () => {
    mockFetchItineraryFull.mockResolvedValue({
      days: [makeDay(1, null, "2026-07-05")],
      goals: [],
      constraints: [],
    })
    render(<ItineraryPageClient />)
    expect(await screen.findByText("Transit")).toBeInTheDocument()
  })

  it("distinct city names all appear across 17 days", async () => {
    mockFetchItineraryFull.mockResolvedValue({
      days: SEVENTEEN_DAYS,
      goals: [],
      constraints: [],
    })
    render(<ItineraryPageClient />)
    await screen.findByText("Day 1")
    // At least one card for each city group
    expect(screen.getAllByText("London").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("Paris").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("Interlaken").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("Milan").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("Transit").length).toBeGreaterThanOrEqual(1)
  })
})

// ── Activity cost mapping ──────────────────────────────────────────────────────

describe("Activity cost mapping from API", () => {
  it("shows correct total cost summed from activity estimated_cost fields", async () => {
    mockFetchItineraryFull.mockResolvedValue({
      days: [DAY_WITH_ACTIVITIES],
      goals: [],
      constraints: [],
    })
    render(<ItineraryPageClient />)
    // totalCost = 50 + 30 = 80; DAY_TYPE_COLORS badge shows "$80"
    expect(await screen.findByText("$80")).toBeInTheDocument()
  })

  it("treats null estimated_cost as 0 — day renders with $0 total", async () => {
    mockFetchItineraryFull.mockResolvedValue({
      days: [DAY_WITH_NULL_COST],
      goals: [],
      constraints: [],
    })
    render(<ItineraryPageClient />)
    expect(await screen.findByText("$0")).toBeInTheDocument()
  })

  it("shows correct activity count from API activities array", async () => {
    mockFetchItineraryFull.mockResolvedValue({
      days: [DAY_WITH_ACTIVITIES],
      goals: [],
      constraints: [],
    })
    render(<ItineraryPageClient />)
    expect(await screen.findByText("2 activities")).toBeInTheDocument()
  })

  it("expanded card shows activity names from API", async () => {
    mockFetchItineraryFull.mockResolvedValue({
      days: [DAY_WITH_ACTIVITIES],
      goals: [],
      constraints: [],
    })
    render(<ItineraryPageClient />)
    const dayBtn = await screen.findByRole("button", { name: /day 1/i })
    fireEvent.click(dayBtn)
    expect(screen.getByText("Borough Market")).toBeInTheDocument()
    expect(screen.getByText("Tower Bridge")).toBeInTheDocument()
  })
})

// ── BUG: Goal save failure — must show error state, not silently roll back ─────
//
// Story focus: "API failure on goal creation shows error state (not silent failure)"
// The component catches the error and calls setGoals(snapshot), reverting to the
// GoalSelector — but renders no error message. These tests are expected to FAIL
// until the developer adds visible error feedback.

describe("Goal save failure — error visibility [BUG expected]", () => {
  it("shows an error message when putTripGoals rejects — not just a silent rollback", async () => {
    mockFetchItineraryFull.mockResolvedValue(NO_GOALS_ITINERARY)
    mockPutTripGoals.mockRejectedValue(new Error("Network error"))

    render(<ItineraryPageClient />)
    await screen.findByText(/choose from presets/i)

    fireEvent.click(
      screen.getByRole("button", { name: "Family-friendly activities" }),
    )
    fireEvent.click(screen.getByRole("button", { name: /save goals/i }))

    // Expect the component to surface a human-readable error, not silently revert.
    // Currently this FAILS — component rolls back with no message.
    await waitFor(() => {
      expect(
        screen.queryByText(/failed|error|try again|could not/i),
      ).toBeInTheDocument()
    })
  })

  it("shows an error message when removing a goal chip fails — not just a silent rollback", async () => {
    mockFetchItineraryFull.mockResolvedValue(WITH_GOALS_ITINERARY)
    mockPutTripGoals.mockRejectedValue(new Error("Network error"))

    render(<ItineraryPageClient />)
    await screen.findByText("Cultural experiences")

    fireEvent.click(
      screen.getByRole("button", { name: /remove cultural experiences/i }),
    )

    // Expect a visible error when the remove call fails.
    // Currently FAILS — component silently restores the chip with no explanation.
    await waitFor(() => {
      expect(
        screen.queryByText(/failed|error|try again|could not/i),
      ).toBeInTheDocument()
    })
  })
})

// ── Save goals button disabled with no selection ───────────────────────────────

describe("Save goals button state", () => {
  it("Save goals button is disabled when no goals are selected", async () => {
    mockFetchItineraryFull.mockResolvedValue(NO_GOALS_ITINERARY)
    render(<ItineraryPageClient />)
    const saveBtn = await screen.findByRole("button", { name: /save goals/i })
    expect(saveBtn).toBeDisabled()
  })

  it("Save goals button is enabled after selecting at least one goal", async () => {
    mockFetchItineraryFull.mockResolvedValue(NO_GOALS_ITINERARY)
    render(<ItineraryPageClient />)
    await screen.findByText(/choose from presets/i)

    fireEvent.click(screen.getByRole("button", { name: "Cultural experiences" }))
    expect(screen.getByRole("button", { name: /save goals/i })).not.toBeDisabled()
  })
})

// ── Mobile sidebar toggle ──────────────────────────────────────────────────────

describe("Mobile sidebar toggle", () => {
  it("toggle button starts with aria-expanded=false", async () => {
    mockFetchItineraryFull.mockResolvedValue(NO_GOALS_ITINERARY)
    render(<ItineraryPageClient />)
    await screen.findByText("London")

    const toggleBtn = screen.getByRole("button", { name: /goals.*constraints/i })
    expect(toggleBtn).toHaveAttribute("aria-expanded", "false")
  })

  it("clicking toggle sets aria-expanded=true", async () => {
    mockFetchItineraryFull.mockResolvedValue(NO_GOALS_ITINERARY)
    render(<ItineraryPageClient />)
    await screen.findByText("London")

    const toggleBtn = screen.getByRole("button", { name: /goals.*constraints/i })
    fireEvent.click(toggleBtn)
    expect(toggleBtn).toHaveAttribute("aria-expanded", "true")
  })

  it("clicking toggle again collapses — aria-expanded returns to false", async () => {
    mockFetchItineraryFull.mockResolvedValue(NO_GOALS_ITINERARY)
    render(<ItineraryPageClient />)
    await screen.findByText("London")

    const toggleBtn = screen.getByRole("button", { name: /goals.*constraints/i })
    fireEvent.click(toggleBtn)
    fireEvent.click(toggleBtn)
    expect(toggleBtn).toHaveAttribute("aria-expanded", "false")
  })

  it("sidebar panel has 'hidden' class when collapsed", async () => {
    mockFetchItineraryFull.mockResolvedValue(NO_GOALS_ITINERARY)
    render(<ItineraryPageClient />)
    await screen.findByText("London")

    const panel = document.getElementById("sidebar-panel")
    expect(panel?.classList.contains("hidden")).toBe(true)
  })

  it("sidebar panel loses 'hidden' class after toggle is clicked", async () => {
    mockFetchItineraryFull.mockResolvedValue(NO_GOALS_ITINERARY)
    render(<ItineraryPageClient />)
    await screen.findByText("London")

    const toggleBtn = screen.getByRole("button", { name: /goals.*constraints/i })
    fireEvent.click(toggleBtn)

    const panel = document.getElementById("sidebar-panel")
    expect(panel?.classList.contains("hidden")).toBe(false)
  })

  it("toggle button aria-controls points to sidebar-panel", async () => {
    mockFetchItineraryFull.mockResolvedValue(NO_GOALS_ITINERARY)
    render(<ItineraryPageClient />)
    await screen.findByText("London")

    const toggleBtn = screen.getByRole("button", { name: /goals.*constraints/i })
    expect(toggleBtn).toHaveAttribute("aria-controls", "sidebar-panel")
  })
})

// ── Constraint temp-ID skip (DELETE not called for unsaved constraints) ────────

describe("Constraint DELETE guard for temp IDs", () => {
  it("does not call deleteTripConstraint when removing a constraint with a temp id", async () => {
    // The temp ID format is "constraint-<timestamp>" — these are optimistic IDs
    // assigned before the POST resolves. If the user removes one immediately
    // (e.g. during a slow network), DELETE must NOT be called.
    mockFetchItineraryFull.mockResolvedValue(WITH_GOALS_ITINERARY)

    const TEMP_CONSTRAINT_ITINERARY: ApiItinerary = {
      ...WITH_GOALS_ITINERARY,
      constraints: [],
    }
    mockFetchItineraryFull.mockResolvedValue(TEMP_CONSTRAINT_ITINERARY)

    // Hold the POST open so the temp ID stays in state
    mockPostTripConstraint.mockImplementation(() => new Promise(() => {}))
    mockDeleteTripConstraint.mockResolvedValue(undefined)

    render(<ItineraryPageClient />)
    await screen.findByText("Cultural experiences")

    // Add a constraint — this creates a temp ID and calls POST (which is stuck)
    fireEvent.change(screen.getByLabelText("Type"), { target: { value: "dietary" } })
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "No shellfish" },
    })
    fireEvent.click(screen.getByRole("button", { name: /add constraint/i }))

    // Wait for optimistic display
    await screen.findByText("No shellfish")

    // Remove the optimistically-displayed constraint
    fireEvent.click(screen.getByRole("button", { name: /delete constraint/i }))
    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }))

    // deleteTripConstraint must NOT be called for a temp ID
    await waitFor(() => {
      expect(mockDeleteTripConstraint).not.toHaveBeenCalled()
    })
  })

  it("calls deleteTripConstraint with uuid when removing a persisted constraint", async () => {
    mockFetchItineraryFull.mockResolvedValue(WITH_CONSTRAINT_ITINERARY)
    mockDeleteTripConstraint.mockResolvedValue(undefined)

    render(<ItineraryPageClient />)
    await screen.findByText("Max $5000 for hotels")

    fireEvent.click(screen.getByRole("button", { name: /delete constraint/i }))
    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }))

    await waitFor(() => {
      expect(mockDeleteTripConstraint).toHaveBeenCalledWith("con-1")
    })
  })
})

// ── Constraint POST failure — no silent leak ───────────────────────────────────

describe("Constraint POST failure", () => {
  it("optimistic constraint is removed from list when POST fails", async () => {
    mockFetchItineraryFull.mockResolvedValue(WITH_GOALS_ITINERARY)
    mockPostTripConstraint.mockRejectedValue(new Error("Server error"))

    render(<ItineraryPageClient />)
    await screen.findByText("Cultural experiences")

    fireEvent.change(screen.getByLabelText("Type"), { target: { value: "dietary" } })
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "No nuts" },
    })
    fireEvent.click(screen.getByRole("button", { name: /add constraint/i }))

    await waitFor(() => {
      expect(screen.queryByText("No nuts")).not.toBeInTheDocument()
    })
  })
})

// ── goalChip label injection guard ────────────────────────────────────────────

describe("Goal label XSS / injection guard", () => {
  it("renders a goal label with HTML-unsafe characters as text, not markup", async () => {
    const XSS_GOAL: ApiGoal = {
      id: "g-xss",
      trip_id: "trip-1",
      goal_type: "custom" as const,
      label: '<script>alert("xss")</script>',
      created_at: "2026-01-01T00:00:00Z",
    }
    mockFetchItineraryFull.mockResolvedValue({
      days: [],
      goals: [XSS_GOAL],
      constraints: [],
    })
    render(<ItineraryPageClient />)
    // Goal chip should display the label as escaped text — no actual script element
    await waitFor(() => {
      expect(document.querySelector("script")).toBeNull()
    })
    // The text is rendered safely
    expect(await screen.findByText(/<script>/)).toBeInTheDocument()
  })
})

// ── Edge: empty goal label trimmed — whitespace-only goal blocked ──────────────

describe("GoalSelector — whitespace-only input blocked", () => {
  it("Save goals button remains disabled when only whitespace has been typed as goal text", async () => {
    // This tests GoalSelector's trim() guard via the ItineraryPageClient.
    // Typing whitespace and clicking Add should not enable Save goals.
    mockFetchItineraryFull.mockResolvedValue(NO_GOALS_ITINERARY)
    render(<ItineraryPageClient />)
    await screen.findByText(/choose from presets/i)

    // No presets selected, no valid custom goal — Save must stay disabled
    const saveBtn = screen.getByRole("button", { name: /save goals/i })
    expect(saveBtn).toBeDisabled()
  })
})
