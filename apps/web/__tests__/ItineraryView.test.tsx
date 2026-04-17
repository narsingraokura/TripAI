import { render, screen, waitFor, fireEvent, within } from "@testing-library/react"
import ItineraryView from "@/components/itinerary/ItineraryView"
import { fetchItinerary, patchItineraryDay } from "@/lib/api"
import type { ItineraryDay } from "@/lib/api"

// ── Mocks ──────────────────────────────────────────────────────────────────────

jest.mock("@/lib/api", () => ({
  fetchItinerary: jest.fn(),
  patchItineraryDay: jest.fn(),
}))

const mockFetchItinerary = fetchItinerary as jest.MockedFunction<
  typeof fetchItinerary
>
const mockPatchItineraryDay = patchItineraryDay as jest.MockedFunction<
  typeof patchItineraryDay
>

// ── Fixtures ───────────────────────────────────────────────────────────────────

const LONDON_DAY: ItineraryDay = {
  id: "d1",
  trip_id: "trip-1",
  date: "2026-06-20",
  city: "London",
  country: "UK",
  title: "Arrive LHR",
  plan: "Arrive at Heathrow, jet lag buffer day",
  intensity: "light",
  is_special: false,
  special_label: null,
}

const PARIS_DAY: ItineraryDay = {
  id: "d2",
  trip_id: "trip-1",
  date: "2026-06-23",
  city: "Paris",
  country: "France",
  title: "Eurostar morning",
  plan: "Take Eurostar from London, arrive Paris, explore Marais",
  intensity: "travel",
  is_special: false,
  special_label: null,
}

const ANNIVERSARY_DAY: ItineraryDay = {
  id: "d3",
  trip_id: "trip-1",
  date: "2026-06-26",
  city: "Paris",
  country: "France",
  title: "Anniversary in Paris",
  plan: "Montmartre morning, dinner at Septime",
  intensity: "special",
  is_special: true,
  special_label: "Anniversary",
}

const MOCK_DAYS = [LONDON_DAY, PARIS_DAY, ANNIVERSARY_DAY]

beforeEach(() => {
  jest.clearAllMocks()
})

// ── Loading state ──────────────────────────────────────────────────────────────

describe("Loading state", () => {
  it("shows loading indicator while fetch is in flight", () => {
    mockFetchItinerary.mockImplementation(() => new Promise(() => {}))
    render(<ItineraryView />)
    expect(screen.getByRole("status")).toBeInTheDocument()
  })

  it("loading indicator has descriptive label", () => {
    mockFetchItinerary.mockImplementation(() => new Promise(() => {}))
    render(<ItineraryView />)
    expect(screen.getByRole("status")).toHaveAttribute(
      "aria-label",
      "Loading itinerary",
    )
  })
})

// ── Error state ────────────────────────────────────────────────────────────────

describe("Error state", () => {
  it("shows error message when API is unreachable", async () => {
    mockFetchItinerary.mockRejectedValue(new Error("Network error"))
    render(<ItineraryView />)
    await waitFor(() => {
      expect(
        screen.getByText(/could not load itinerary/i),
      ).toBeInTheDocument()
    })
  })

  it("shows Retry button on error", async () => {
    mockFetchItinerary.mockRejectedValue(new Error("Network error"))
    render(<ItineraryView />)
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /retry/i }),
      ).toBeInTheDocument()
    })
  })

  it("clicking Retry re-fetches and shows days on success", async () => {
    mockFetchItinerary
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce(MOCK_DAYS)

    render(<ItineraryView />)
    const retryBtn = await screen.findByRole("button", { name: /retry/i })
    fireEvent.click(retryBtn)

    expect(await screen.findByText("Arrive LHR")).toBeInTheDocument()
    expect(mockFetchItinerary).toHaveBeenCalledTimes(2)
  })
})

// ── Success state ──────────────────────────────────────────────────────────────

describe("Success state", () => {
  beforeEach(() => {
    mockFetchItinerary.mockResolvedValue(MOCK_DAYS)
  })

  it("renders city group headers", async () => {
    render(<ItineraryView />)
    await screen.findByText("Arrive LHR")
    expect(screen.getByText("London")).toBeInTheDocument()
    expect(screen.getByText("Paris")).toBeInTheDocument()
  })

  it("renders all day titles", async () => {
    render(<ItineraryView />)
    expect(await screen.findByText("Arrive LHR")).toBeInTheDocument()
    expect(screen.getByText("Eurostar morning")).toBeInTheDocument()
    expect(screen.getByText("Anniversary in Paris")).toBeInTheDocument()
  })

  it("renders special label for special days", async () => {
    render(<ItineraryView />)
    await screen.findByText("Anniversary in Paris")
    expect(screen.getByText("Anniversary")).toBeInTheDocument()
  })

  it("does not render plan text before expanding a day", async () => {
    render(<ItineraryView />)
    await screen.findByText("Arrive LHR")
    expect(
      screen.queryByText("Arrive at Heathrow, jet lag buffer day"),
    ).not.toBeInTheDocument()
  })
})

// ── Expand / collapse ──────────────────────────────────────────────────────────

describe("Expand and collapse", () => {
  beforeEach(() => {
    mockFetchItinerary.mockResolvedValue(MOCK_DAYS)
  })

  it("clicking a day reveals its plan text", async () => {
    render(<ItineraryView />)
    const toggle = await screen.findByRole("button", { name: /arrive lhr/i })
    fireEvent.click(toggle)
    expect(
      screen.getByText("Arrive at Heathrow, jet lag buffer day"),
    ).toBeInTheDocument()
  })

  it("clicking the same day again collapses it", async () => {
    render(<ItineraryView />)
    const toggle = await screen.findByRole("button", { name: /arrive lhr/i })
    fireEvent.click(toggle)
    fireEvent.click(toggle)
    expect(
      screen.queryByText("Arrive at Heathrow, jet lag buffer day"),
    ).not.toBeInTheDocument()
  })

  it("only one day is expanded at a time", async () => {
    render(<ItineraryView />)
    const londonToggle = await screen.findByRole("button", {
      name: /arrive lhr/i,
    })
    const parisToggle = screen.getByRole("button", { name: /eurostar morning/i })

    fireEvent.click(londonToggle)
    expect(
      screen.getByText("Arrive at Heathrow, jet lag buffer day"),
    ).toBeInTheDocument()

    fireEvent.click(parisToggle)
    expect(
      screen.queryByText("Arrive at Heathrow, jet lag buffer day"),
    ).not.toBeInTheDocument()
    expect(screen.getByText(/take eurostar/i)).toBeInTheDocument()
  })
})

// ── Edit mode ──────────────────────────────────────────────────────────────────

describe("Edit mode", () => {
  beforeEach(() => {
    mockFetchItinerary.mockResolvedValue(MOCK_DAYS)
  })

  it("clicking Edit shows the editor form with current values", async () => {
    render(<ItineraryView />)
    const headerBtn = await screen.findByRole("button", { name: /arrive lhr/i })
    fireEvent.click(within(headerBtn.parentElement!).getByRole("button", { name: /edit/i }))

    expect(screen.getByDisplayValue("Arrive LHR")).toBeInTheDocument()
    expect(
      screen.getByDisplayValue("Arrive at Heathrow, jet lag buffer day"),
    ).toBeInTheDocument()
  })

  it("Cancel hides the editor and makes no API call", async () => {
    render(<ItineraryView />)
    const headerBtn = await screen.findByRole("button", { name: /arrive lhr/i })
    fireEvent.click(within(headerBtn.parentElement!).getByRole("button", { name: /edit/i }))
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }))

    expect(screen.queryByDisplayValue("Arrive LHR")).not.toBeInTheDocument()
    expect(mockPatchItineraryDay).not.toHaveBeenCalled()
  })

  it("Cancel after editing reverts input without touching state", async () => {
    render(<ItineraryView />)
    const headerBtn = await screen.findByRole("button", { name: /arrive lhr/i })
    fireEvent.click(within(headerBtn.parentElement!).getByRole("button", { name: /edit/i }))

    const titleInput = screen.getByDisplayValue("Arrive LHR")
    fireEvent.change(titleInput, { target: { value: "Changed title" } })

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }))

    expect(screen.getByText("Arrive LHR")).toBeInTheDocument()
    expect(screen.queryByText("Changed title")).not.toBeInTheDocument()
  })
})

// ── Save (PATCH) ───────────────────────────────────────────────────────────────

describe("Save", () => {
  beforeEach(() => {
    mockFetchItinerary.mockResolvedValue(MOCK_DAYS)
  })

  it("calls patchItineraryDay with correct date and patch body", async () => {
    mockPatchItineraryDay.mockResolvedValue({
      ...LONDON_DAY,
      title: "Updated title",
    })

    render(<ItineraryView />)
    const headerBtn = await screen.findByRole("button", { name: /arrive lhr/i })
    fireEvent.click(within(headerBtn.parentElement!).getByRole("button", { name: /edit/i }))

    const titleInput = screen.getByDisplayValue("Arrive LHR")
    fireEvent.change(titleInput, { target: { value: "Updated title" } })

    fireEvent.click(screen.getByRole("button", { name: /save/i }))

    await waitFor(() => {
      expect(mockPatchItineraryDay).toHaveBeenCalledWith(
        "2026-06-20",
        expect.objectContaining({ title: "Updated title" }),
      )
    })
  })

  it("shows updated title after successful save", async () => {
    mockPatchItineraryDay.mockResolvedValue({
      ...LONDON_DAY,
      title: "Updated title",
    })

    render(<ItineraryView />)
    const headerBtn = await screen.findByRole("button", { name: /arrive lhr/i })
    fireEvent.click(within(headerBtn.parentElement!).getByRole("button", { name: /edit/i }))

    fireEvent.change(screen.getByDisplayValue("Arrive LHR"), {
      target: { value: "Updated title" },
    })
    fireEvent.click(screen.getByRole("button", { name: /save/i }))

    expect(
      await screen.findByRole("button", { name: /updated title/i }),
    ).toBeInTheDocument()
  })

  it("reverts to original title when PATCH fails", async () => {
    mockPatchItineraryDay.mockRejectedValue(new Error("API error: 500"))

    render(<ItineraryView />)
    const headerBtn = await screen.findByRole("button", { name: /arrive lhr/i })
    fireEvent.click(within(headerBtn.parentElement!).getByRole("button", { name: /edit/i }))

    fireEvent.change(screen.getByDisplayValue("Arrive LHR"), {
      target: { value: "Changed title" },
    })
    fireEvent.click(screen.getByRole("button", { name: /save/i }))

    await waitFor(() => {
      expect(screen.queryByText("Changed title")).not.toBeInTheDocument()
    })
    expect(screen.getByText("Arrive LHR")).toBeInTheDocument()
  })

  it("shows save error message when PATCH fails", async () => {
    mockPatchItineraryDay.mockRejectedValue(new Error("API error: 500"))

    render(<ItineraryView />)
    const headerBtn = await screen.findByRole("button", { name: /arrive lhr/i })
    fireEvent.click(within(headerBtn.parentElement!).getByRole("button", { name: /edit/i }))

    fireEvent.change(screen.getByDisplayValue("Arrive LHR"), {
      target: { value: "Changed title" },
    })
    fireEvent.click(screen.getByRole("button", { name: /save/i }))

    await waitFor(() => {
      expect(screen.getByText(/failed to save/i)).toBeInTheDocument()
    })
  })
})
