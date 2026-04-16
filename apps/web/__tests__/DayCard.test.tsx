import { render, screen, fireEvent } from "@testing-library/react"
import DayCard from "@/components/itinerary/DayCard"
import type { ItineraryDay } from "@/lib/api"

// ── Fixtures ───────────────────────────────────────────────────────────────────

const MOCK_DAY: ItineraryDay = {
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

const defaultProps = {
  day: MOCK_DAY,
  isExpanded: false,
  isEditing: false,
  draft: null,
  saving: false,
  saveError: null,
  onToggleExpand: jest.fn(),
  onStartEdit: jest.fn(),
  onDraftChange: jest.fn(),
  onSave: jest.fn(),
  onCancel: jest.fn(),
}

const DRAFT = {
  title: "Arrive LHR",
  plan: "Arrive at Heathrow, jet lag buffer day",
  intensity: "light" as const,
}

beforeEach(() => {
  jest.clearAllMocks()
})

// ── Collapsed view ─────────────────────────────────────────────────────────────

describe("Collapsed view", () => {
  it("shows the day title", () => {
    render(<DayCard {...defaultProps} />)
    expect(screen.getByText("Arrive LHR")).toBeInTheDocument()
  })

  it("shows the intensity badge", () => {
    render(<DayCard {...defaultProps} />)
    expect(screen.getByText("light")).toBeInTheDocument()
  })

  it("does not show plan text when collapsed", () => {
    render(<DayCard {...defaultProps} />)
    expect(
      screen.queryByText("Arrive at Heathrow, jet lag buffer day"),
    ).not.toBeInTheDocument()
  })

  it("shows special label for special days", () => {
    const specialDay = { ...MOCK_DAY, is_special: true, special_label: "Anniversary" }
    render(<DayCard {...defaultProps} day={specialDay} />)
    expect(screen.getByText("Anniversary")).toBeInTheDocument()
  })

  it("does not show Edit button when collapsed", () => {
    render(<DayCard {...defaultProps} />)
    expect(
      screen.queryByRole("button", { name: /edit/i }),
    ).not.toBeInTheDocument()
  })
})

// ── Expanded view ──────────────────────────────────────────────────────────────

describe("Expanded view", () => {
  it("shows full plan text when expanded", () => {
    render(<DayCard {...defaultProps} isExpanded={true} />)
    expect(
      screen.getByText("Arrive at Heathrow, jet lag buffer day"),
    ).toBeInTheDocument()
  })

  it("shows Edit button when expanded", () => {
    render(<DayCard {...defaultProps} isExpanded={true} />)
    expect(screen.getByRole("button", { name: /edit/i })).toBeInTheDocument()
  })
})

// ── Edit mode ──────────────────────────────────────────────────────────────────

describe("Edit mode", () => {
  it("shows title input with current value", () => {
    render(
      <DayCard
        {...defaultProps}
        isExpanded={true}
        isEditing={true}
        draft={DRAFT}
      />,
    )
    expect(screen.getByDisplayValue("Arrive LHR")).toBeInTheDocument()
  })

  it("shows plan textarea with current value", () => {
    render(
      <DayCard
        {...defaultProps}
        isExpanded={true}
        isEditing={true}
        draft={DRAFT}
      />,
    )
    expect(
      screen.getByDisplayValue("Arrive at Heathrow, jet lag buffer day"),
    ).toBeInTheDocument()
  })

  it("shows Save and Cancel buttons", () => {
    render(
      <DayCard
        {...defaultProps}
        isExpanded={true}
        isEditing={true}
        draft={DRAFT}
      />,
    )
    expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument()
  })

  it("shows save error when provided", () => {
    render(
      <DayCard
        {...defaultProps}
        isExpanded={true}
        isEditing={true}
        draft={DRAFT}
        saveError="Failed to save"
      />,
    )
    expect(screen.getByText("Failed to save")).toBeInTheDocument()
  })
})

// ── Interactions ───────────────────────────────────────────────────────────────

describe("Interactions", () => {
  it("clicking the toggle button calls onToggleExpand", () => {
    const onToggleExpand = jest.fn()
    render(<DayCard {...defaultProps} onToggleExpand={onToggleExpand} />)
    fireEvent.click(screen.getByRole("button", { name: /arrive lhr/i }))
    expect(onToggleExpand).toHaveBeenCalledTimes(1)
  })

  it("clicking Edit calls onStartEdit", () => {
    const onStartEdit = jest.fn()
    render(
      <DayCard {...defaultProps} isExpanded={true} onStartEdit={onStartEdit} />,
    )
    fireEvent.click(screen.getByRole("button", { name: /edit/i }))
    expect(onStartEdit).toHaveBeenCalledTimes(1)
  })

  it("clicking Save calls onSave", () => {
    const onSave = jest.fn()
    render(
      <DayCard
        {...defaultProps}
        isExpanded={true}
        isEditing={true}
        draft={DRAFT}
        onSave={onSave}
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: /save/i }))
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it("clicking Cancel calls onCancel", () => {
    const onCancel = jest.fn()
    render(
      <DayCard
        {...defaultProps}
        isExpanded={true}
        isEditing={true}
        draft={DRAFT}
        onCancel={onCancel}
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
