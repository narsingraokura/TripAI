import { render, screen, fireEvent } from "@testing-library/react"
import ItineraryDayCard from "@/components/itinerary/ItineraryDayCard"
import type { Day } from "@/types/itinerary"

const MOCK_DAY: Day = {
  id: "d1",
  date: "2026-06-20",
  city: "London",
  country: "UK",
  dayType: "leisure",
  activities: [
    { id: "a1", name: "Borough Market Tour", category: "food", cost: 50, durationMinutes: 90 },
    { id: "a2", name: "Tower Bridge Walk", category: "sightseeing", cost: 30, durationMinutes: 60 },
  ],
}

const defaultProps = {
  day: MOCK_DAY,
  dayNumber: 1,
  isExpanded: false,
  onToggleExpand: jest.fn(),
  onEdit: jest.fn(),
  onRemove: jest.fn(),
}

beforeEach(() => {
  jest.clearAllMocks()
})

// ── Collapsed view ──────────────────────────────────────────────────────────────

describe("Collapsed view", () => {
  it("shows the day number", () => {
    render(<ItineraryDayCard {...defaultProps} />)
    expect(screen.getByText("Day 1")).toBeInTheDocument()
  })

  it("shows the city", () => {
    render(<ItineraryDayCard {...defaultProps} />)
    expect(screen.getByText("London")).toBeInTheDocument()
  })

  it("shows the formatted date", () => {
    render(<ItineraryDayCard {...defaultProps} />)
    expect(screen.getByText(/Jun 20/)).toBeInTheDocument()
  })

  it("shows activity count (plural)", () => {
    render(<ItineraryDayCard {...defaultProps} />)
    expect(screen.getByText("2 activities")).toBeInTheDocument()
  })

  it("shows singular 'activity' for a single activity", () => {
    const day: Day = { ...MOCK_DAY, activities: [MOCK_DAY.activities[0]] }
    render(<ItineraryDayCard {...defaultProps} day={day} />)
    expect(screen.getByText("1 activity")).toBeInTheDocument()
  })

  it("shows total cost of all activities", () => {
    render(<ItineraryDayCard {...defaultProps} />)
    // 50 + 30 = 80
    expect(screen.getByText("$80")).toBeInTheDocument()
  })

  it("does not show activity list when collapsed", () => {
    render(<ItineraryDayCard {...defaultProps} />)
    expect(screen.queryByText("Borough Market Tour")).not.toBeInTheDocument()
  })

  it("does not show edit/remove buttons when collapsed", () => {
    render(<ItineraryDayCard {...defaultProps} />)
    expect(screen.queryByRole("button", { name: /edit/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /remove/i })).not.toBeInTheDocument()
  })
})

// ── Expanded view ───────────────────────────────────────────────────────────────

describe("Expanded view", () => {
  it("shows activity names when expanded", () => {
    render(<ItineraryDayCard {...defaultProps} isExpanded />)
    expect(screen.getByText("Borough Market Tour")).toBeInTheDocument()
    expect(screen.getByText("Tower Bridge Walk")).toBeInTheDocument()
  })

  it("shows edit button when expanded", () => {
    render(<ItineraryDayCard {...defaultProps} isExpanded />)
    expect(screen.getByRole("button", { name: /edit/i })).toBeInTheDocument()
  })

  it("shows remove button when expanded", () => {
    render(<ItineraryDayCard {...defaultProps} isExpanded />)
    expect(screen.getByRole("button", { name: /remove/i })).toBeInTheDocument()
  })

  it("shows empty state CTA when day has no activities", () => {
    const empty: Day = { ...MOCK_DAY, activities: [] }
    render(<ItineraryDayCard {...defaultProps} day={empty} isExpanded />)
    expect(screen.getByText(/no activities/i)).toBeInTheDocument()
  })

  it("shows $0 cost when no activities", () => {
    const empty: Day = { ...MOCK_DAY, activities: [] }
    render(<ItineraryDayCard {...defaultProps} day={empty} />)
    expect(screen.getByText("$0")).toBeInTheDocument()
  })
})

// ── Interactions ────────────────────────────────────────────────────────────────

describe("Interactions", () => {
  it("clicking header calls onToggleExpand", () => {
    const onToggleExpand = jest.fn()
    render(<ItineraryDayCard {...defaultProps} onToggleExpand={onToggleExpand} />)
    fireEvent.click(screen.getByRole("button", { name: /day 1/i }))
    expect(onToggleExpand).toHaveBeenCalledTimes(1)
  })

  it("clicking Edit calls onEdit", () => {
    const onEdit = jest.fn()
    render(<ItineraryDayCard {...defaultProps} isExpanded onEdit={onEdit} />)
    fireEvent.click(screen.getByRole("button", { name: /edit/i }))
    expect(onEdit).toHaveBeenCalledTimes(1)
  })

  it("clicking Remove calls onRemove", () => {
    const onRemove = jest.fn()
    render(<ItineraryDayCard {...defaultProps} isExpanded onRemove={onRemove} />)
    fireEvent.click(screen.getByRole("button", { name: /remove/i }))
    expect(onRemove).toHaveBeenCalledTimes(1)
  })
})
