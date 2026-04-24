import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import ItineraryPageClient from "@/components/itinerary/ItineraryPageClient"
import type { ApiConstraint, ApiGoal, ApiItinerary } from "@/lib/api"
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

const LONDON_DAY = {
  id: "day-1",
  trip_id: "trip-1",
  position: 1,
  date: "2026-06-20",
  city: "London",
  day_type: "exploration" as const,
  notes: "Arrive LHR",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  activities: [],
}

const PARIS_DAY = {
  id: "day-2",
  trip_id: "trip-1",
  position: 2,
  date: "2026-06-23",
  city: "Paris",
  day_type: "exploration" as const,
  notes: "Eurostar morning",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  activities: [],
}

const CULTURAL_GOAL: ApiGoal = {
  id: "goal-1",
  trip_id: "trip-1",
  goal_type: "preset",
  label: "Cultural experiences",
  created_at: "2026-01-01T00:00:00Z",
}

const FAMILY_GOAL: ApiGoal = {
  id: "goal-family",
  trip_id: "trip-1",
  goal_type: "preset",
  label: "Family-friendly activities",
  created_at: "2026-01-01T00:00:00Z",
}

const BUDGET_CONSTRAINT: ApiConstraint = {
  id: "con-1",
  trip_id: "trip-1",
  constraint_type: "budget_cap",
  description: "Max $5000 for hotels",
  value: 5000,
  created_at: "2026-01-01T00:00:00Z",
}

const NO_DAYS_ITINERARY: ApiItinerary = { days: [], goals: [], constraints: [] }

const NO_GOALS_ITINERARY: ApiItinerary = {
  days: [LONDON_DAY, PARIS_DAY],
  goals: [],
  constraints: [],
}

const WITH_GOALS_ITINERARY: ApiItinerary = {
  days: [LONDON_DAY, PARIS_DAY],
  goals: [CULTURAL_GOAL],
  constraints: [],
}

const FULL_ITINERARY: ApiItinerary = {
  days: [LONDON_DAY, PARIS_DAY],
  goals: [CULTURAL_GOAL],
  constraints: [BUDGET_CONSTRAINT],
}

beforeEach(() => {
  jest.clearAllMocks()
})

// ── Loading state ──────────────────────────────────────────────────────────────

describe("Loading state", () => {
  it("shows skeleton while fetch is in flight", () => {
    mockFetchItineraryFull.mockImplementation(() => new Promise(() => {}))
    render(<ItineraryPageClient />)
    expect(screen.getByRole("status")).toBeInTheDocument()
  })

  it("skeleton has aria-label 'Loading itinerary'", () => {
    mockFetchItineraryFull.mockImplementation(() => new Promise(() => {}))
    render(<ItineraryPageClient />)
    expect(screen.getByRole("status")).toHaveAttribute(
      "aria-label",
      "Loading itinerary",
    )
  })
})

// ── Error state ────────────────────────────────────────────────────────────────

describe("Error state", () => {
  it("shows error message when fetch fails", async () => {
    mockFetchItineraryFull.mockRejectedValue(new Error("Network error"))
    render(<ItineraryPageClient />)
    await waitFor(() => {
      expect(screen.getByText(/could not load itinerary/i)).toBeInTheDocument()
    })
  })

  it("shows Retry button on error", async () => {
    mockFetchItineraryFull.mockRejectedValue(new Error("Network error"))
    render(<ItineraryPageClient />)
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument()
    })
  })

  it("Retry re-fetches and shows days on success", async () => {
    mockFetchItineraryFull
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce(NO_GOALS_ITINERARY)

    render(<ItineraryPageClient />)
    const retryBtn = await screen.findByRole("button", { name: /retry/i })
    fireEvent.click(retryBtn)

    expect(await screen.findByText("London")).toBeInTheDocument()
    expect(mockFetchItineraryFull).toHaveBeenCalledTimes(2)
  })
})

// ── Empty days ─────────────────────────────────────────────────────────────────

describe("Empty days", () => {
  it("shows Start planning CTA when no days returned", async () => {
    mockFetchItineraryFull.mockResolvedValue(NO_DAYS_ITINERARY)
    render(<ItineraryPageClient />)
    expect(
      await screen.findByRole("button", { name: /start planning/i }),
    ).toBeInTheDocument()
  })
})

// ── Day cards ──────────────────────────────────────────────────────────────────

describe("Day cards", () => {
  beforeEach(() => {
    mockFetchItineraryFull.mockResolvedValue(NO_GOALS_ITINERARY)
  })

  it("renders city for each day", async () => {
    render(<ItineraryPageClient />)
    expect(await screen.findByText("London")).toBeInTheDocument()
    expect(screen.getByText("Paris")).toBeInTheDocument()
  })

  it("day cards start collapsed — edit button not visible", async () => {
    render(<ItineraryPageClient />)
    await screen.findByText("London")
    expect(screen.queryAllByRole("button", { name: /edit/i })).toHaveLength(0)
  })

  it("clicking a card header expands it — shows Edit button", async () => {
    render(<ItineraryPageClient />)
    const day1Btn = await screen.findByRole("button", { name: /day 1/i })
    fireEvent.click(day1Btn)
    expect(screen.getByRole("button", { name: /edit/i })).toBeInTheDocument()
  })

  it("clicking an expanded card collapses it — hides Edit button", async () => {
    render(<ItineraryPageClient />)
    const day1Btn = await screen.findByRole("button", { name: /day 1/i })
    fireEvent.click(day1Btn)
    expect(screen.getByRole("button", { name: /edit/i })).toBeInTheDocument()
    fireEvent.click(day1Btn)
    expect(screen.queryByRole("button", { name: /edit/i })).not.toBeInTheDocument()
  })

  it("only one card expanded at a time", async () => {
    render(<ItineraryPageClient />)
    const day1Btn = await screen.findByRole("button", { name: /day 1/i })
    const day2Btn = screen.getByRole("button", { name: /day 2/i })

    fireEvent.click(day1Btn)
    expect(screen.getAllByRole("button", { name: /edit/i })).toHaveLength(1)

    fireEvent.click(day2Btn)
    expect(screen.getAllByRole("button", { name: /edit/i })).toHaveLength(1)
  })
})

// ── Goals — onboarding (no goals) ─────────────────────────────────────────────

describe("Goals — onboarding (no goals)", () => {
  it("shows GoalSelector when no goals loaded", async () => {
    mockFetchItineraryFull.mockResolvedValue(NO_GOALS_ITINERARY)
    render(<ItineraryPageClient />)
    expect(await screen.findByText(/choose from presets/i)).toBeInTheDocument()
  })

  it("shows Save goals button when no goals loaded", async () => {
    mockFetchItineraryFull.mockResolvedValue(NO_GOALS_ITINERARY)
    render(<ItineraryPageClient />)
    expect(
      await screen.findByRole("button", { name: /save goals/i }),
    ).toBeInTheDocument()
  })
})

// ── Goals — with goals loaded ──────────────────────────────────────────────────

describe("Goals — with goals loaded", () => {
  it("shows goal chip for each loaded goal — GoalSelector not shown", async () => {
    mockFetchItineraryFull.mockResolvedValue(WITH_GOALS_ITINERARY)
    render(<ItineraryPageClient />)
    await screen.findByText("Cultural experiences")
    expect(screen.queryByText(/choose from presets/i)).not.toBeInTheDocument()
  })

  it("does not show Save goals button when goals are loaded", async () => {
    mockFetchItineraryFull.mockResolvedValue(WITH_GOALS_ITINERARY)
    render(<ItineraryPageClient />)
    await screen.findByText("Cultural experiences")
    expect(
      screen.queryByRole("button", { name: /save goals/i }),
    ).not.toBeInTheDocument()
  })

  it("removing a goal chip calls putTripGoals without it", async () => {
    mockFetchItineraryFull.mockResolvedValue(WITH_GOALS_ITINERARY)
    mockPutTripGoals.mockResolvedValue([])

    render(<ItineraryPageClient />)
    await screen.findByText("Cultural experiences")

    fireEvent.click(
      screen.getByRole("button", { name: /remove cultural experiences/i }),
    )

    await waitFor(() => {
      expect(mockPutTripGoals).toHaveBeenCalledWith([])
    })
  })
})

// ── Save Goals ─────────────────────────────────────────────────────────────────

describe("Save Goals", () => {
  it("clicking Save Goals calls putTripGoals with selected goals", async () => {
    mockFetchItineraryFull.mockResolvedValue(NO_GOALS_ITINERARY)
    mockPutTripGoals.mockResolvedValue([FAMILY_GOAL])

    render(<ItineraryPageClient />)
    await screen.findByText(/choose from presets/i)

    fireEvent.click(
      screen.getByRole("button", { name: "Family-friendly activities" }),
    )
    fireEvent.click(screen.getByRole("button", { name: /save goals/i }))

    await waitFor(() => {
      expect(mockPutTripGoals).toHaveBeenCalledWith([
        { goal_type: "preset", label: "Family-friendly activities" },
      ])
    })
  })

  it("optimistically switches to chip view before PUT resolves", async () => {
    mockFetchItineraryFull.mockResolvedValue(NO_GOALS_ITINERARY)
    mockPutTripGoals.mockImplementation(() => new Promise(() => {}))

    render(<ItineraryPageClient />)
    await screen.findByText(/choose from presets/i)

    fireEvent.click(
      screen.getByRole("button", { name: "Family-friendly activities" }),
    )
    fireEvent.click(screen.getByRole("button", { name: /save goals/i }))

    await waitFor(() => {
      expect(screen.queryByText(/choose from presets/i)).not.toBeInTheDocument()
    })
  })

  it("rolls back to GoalSelector view on PUT failure", async () => {
    mockFetchItineraryFull.mockResolvedValue(NO_GOALS_ITINERARY)
    mockPutTripGoals.mockRejectedValue(new Error("Network error"))

    render(<ItineraryPageClient />)
    await screen.findByText(/choose from presets/i)

    fireEvent.click(
      screen.getByRole("button", { name: "Family-friendly activities" }),
    )
    fireEvent.click(screen.getByRole("button", { name: /save goals/i }))

    await waitFor(() => {
      expect(screen.getByText(/choose from presets/i)).toBeInTheDocument()
    })
  })
})

// ── Constraints ────────────────────────────────────────────────────────────────

describe("Constraints", () => {
  it("shows loaded constraints in sidebar", async () => {
    mockFetchItineraryFull.mockResolvedValue(FULL_ITINERARY)
    render(<ItineraryPageClient />)
    expect(await screen.findByText("Max $5000 for hotels")).toBeInTheDocument()
  })

  it("adding a constraint calls postTripConstraint", async () => {
    mockFetchItineraryFull.mockResolvedValue(WITH_GOALS_ITINERARY)
    mockPostTripConstraint.mockResolvedValue({
      id: "con-new",
      trip_id: "trip-1",
      constraint_type: "custom",
      description: "No shellfish",
      value: null,
      created_at: "2026-01-01T00:00:00Z",
    })

    render(<ItineraryPageClient />)
    await screen.findByText("Cultural experiences")

    fireEvent.change(screen.getByLabelText("Type"), { target: { value: "dietary" } })
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "No shellfish" },
    })
    fireEvent.click(screen.getByRole("button", { name: /add constraint/i }))

    await waitFor(() => {
      expect(mockPostTripConstraint).toHaveBeenCalledWith(
        expect.objectContaining({
          constraint_type: "custom",
          description: "No shellfish",
        }),
      )
    })
  })

  it("added constraint appears optimistically before POST resolves", async () => {
    mockFetchItineraryFull.mockResolvedValue(WITH_GOALS_ITINERARY)
    mockPostTripConstraint.mockImplementation(() => new Promise(() => {}))

    render(<ItineraryPageClient />)
    await screen.findByText("Cultural experiences")

    fireEvent.change(screen.getByLabelText("Type"), { target: { value: "dietary" } })
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "No shellfish" },
    })
    fireEvent.click(screen.getByRole("button", { name: /add constraint/i }))

    await waitFor(() => {
      expect(screen.getByText("No shellfish")).toBeInTheDocument()
    })
  })

  it("removes optimistic constraint if POST fails", async () => {
    mockFetchItineraryFull.mockResolvedValue(WITH_GOALS_ITINERARY)
    mockPostTripConstraint.mockRejectedValue(new Error("Network error"))

    render(<ItineraryPageClient />)
    await screen.findByText("Cultural experiences")

    fireEvent.change(screen.getByLabelText("Type"), { target: { value: "dietary" } })
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "No shellfish" },
    })
    fireEvent.click(screen.getByRole("button", { name: /add constraint/i }))

    await waitFor(() => {
      expect(screen.queryByText("No shellfish")).not.toBeInTheDocument()
    })
  })

  it("removing a persisted constraint calls deleteTripConstraint with its id", async () => {
    mockFetchItineraryFull.mockResolvedValue(FULL_ITINERARY)
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
