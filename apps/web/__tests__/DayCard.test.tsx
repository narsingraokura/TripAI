import { render, screen, fireEvent } from "@testing-library/react"
import DayCard from "@/components/itinerary/DayCard"
import type { ItineraryDay, Suggestion } from "@/lib/api"

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

// Covers all cost_delta cases: negative, zero, positive
const MOCK_SUGGESTIONS: Suggestion[] = [
  {
    title: "Harder Kulm Viewpoint",
    description: "Take the funicular up to Harder Kulm for panoramic views.",
    why_fits: "Kid-friendly, half-day activity, no altitude concerns.",
    cost_delta: -220,
    intensity: "light",
    booking_required: false,
  },
  {
    title: "Lake Brienz Boat Tour",
    description: "Cruise the turquoise Lake Brienz to Giessbach Falls.",
    why_fits: "Relaxing boat ride kids love.",
    cost_delta: 0,
    intensity: "light",
    booking_required: false,
  },
  {
    title: "Jungfraujoch Top of Europe",
    description: "Journey to the highest railway station in Europe.",
    why_fits: "Iconic Swiss landmark with indoor glacier cave.",
    cost_delta: 180,
    intensity: "busy",
    booking_required: true,
  },
]

const defaultProps = {
  day: MOCK_DAY,
  isExpanded: false,
  isEditing: false,
  draft: null,
  saving: false,
  saveError: null,
  suggestLoading: false,
  suggestions: null,
  suggestError: null,
  onToggleExpand: jest.fn(),
  onStartEdit: jest.fn(),
  onDraftChange: jest.fn(),
  onSave: jest.fn(),
  onCancel: jest.fn(),
  onSuggest: jest.fn(),
  onSelectSuggestion: jest.fn(),
  onDelete: jest.fn(),
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

  it("shows Edit button even when collapsed (always inline)", () => {
    render(<DayCard {...defaultProps} />)
    expect(screen.getByRole("button", { name: /edit/i })).toBeInTheDocument()
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

// ── Inline actions (always visible) ───────────────────────────────────────────

describe("Inline action row", () => {
  it("shows Remove button when collapsed", () => {
    render(<DayCard {...defaultProps} />)
    expect(screen.getByRole("button", { name: /remove/i })).toBeInTheDocument()
  })

  it("shows Remove button when expanded", () => {
    render(<DayCard {...defaultProps} isExpanded={true} />)
    expect(screen.getByRole("button", { name: /remove/i })).toBeInTheDocument()
  })

  it("clicking Remove calls onDelete", () => {
    const onDelete = jest.fn()
    render(<DayCard {...defaultProps} onDelete={onDelete} />)
    fireEvent.click(screen.getByRole("button", { name: /remove/i }))
    expect(onDelete).toHaveBeenCalledTimes(1)
  })

  it("action row (Edit/Suggest/Remove) is hidden in edit mode", () => {
    render(
      <DayCard {...defaultProps} isExpanded={true} isEditing={true} draft={DRAFT} />,
    )
    expect(screen.queryByRole("button", { name: /remove/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /suggest alternatives/i })).not.toBeInTheDocument()
  })
})

// ── Suggest alternatives button ────────────────────────────────────────────────

describe("Suggest alternatives button", () => {
  it("shows 'Suggest alternatives' button even when collapsed", () => {
    render(<DayCard {...defaultProps} isExpanded={false} />)
    expect(
      screen.getByRole("button", { name: /suggest alternatives/i }),
    ).toBeInTheDocument()
  })

  it("shows 'Suggest alternatives' button when expanded", () => {
    render(<DayCard {...defaultProps} isExpanded={true} />)
    expect(
      screen.getByRole("button", { name: /suggest alternatives/i }),
    ).toBeInTheDocument()
  })

  it("does not show 'Suggest alternatives' button in edit mode", () => {
    render(
      <DayCard {...defaultProps} isExpanded={true} isEditing={true} draft={DRAFT} />,
    )
    expect(
      screen.queryByRole("button", { name: /suggest alternatives/i }),
    ).not.toBeInTheDocument()
  })

  it("clicking 'Suggest alternatives' calls onSuggest", () => {
    const onSuggest = jest.fn()
    render(<DayCard {...defaultProps} isExpanded={true} onSuggest={onSuggest} />)
    fireEvent.click(screen.getByRole("button", { name: /suggest alternatives/i }))
    expect(onSuggest).toHaveBeenCalledTimes(1)
  })

  it("button is disabled and shows 'Thinking…' while suggestLoading is true", () => {
    render(<DayCard {...defaultProps} isExpanded={true} suggestLoading={true} />)
    const btn = screen.getByRole("button", { name: /thinking/i })
    expect(btn).toBeDisabled()
  })
})

// ── Suggestion panel ───────────────────────────────────────────────────────────

describe("Suggestion panel", () => {
  it("shows 3 suggestion cards when suggestions provided", () => {
    render(
      <DayCard {...defaultProps} isExpanded={true} suggestions={MOCK_SUGGESTIONS} />,
    )
    expect(screen.getByText("Harder Kulm Viewpoint")).toBeInTheDocument()
    expect(screen.getByText("Lake Brienz Boat Tour")).toBeInTheDocument()
    expect(screen.getByText("Jungfraujoch Top of Europe")).toBeInTheDocument()
  })

  it("does not show suggestion panel when collapsed", () => {
    render(
      <DayCard {...defaultProps} isExpanded={false} suggestions={MOCK_SUGGESTIONS} />,
    )
    expect(screen.queryByText("Harder Kulm Viewpoint")).not.toBeInTheDocument()
  })

  it("formats negative cost_delta as '-$220'", () => {
    render(
      <DayCard {...defaultProps} isExpanded={true} suggestions={MOCK_SUGGESTIONS} />,
    )
    expect(screen.getByText("-$220")).toBeInTheDocument()
  })

  it("formats zero cost_delta as 'same cost'", () => {
    render(
      <DayCard {...defaultProps} isExpanded={true} suggestions={MOCK_SUGGESTIONS} />,
    )
    expect(screen.getByText("same cost")).toBeInTheDocument()
  })

  it("formats positive cost_delta as '+$180'", () => {
    render(
      <DayCard {...defaultProps} isExpanded={true} suggestions={MOCK_SUGGESTIONS} />,
    )
    expect(screen.getByText("+$180")).toBeInTheDocument()
  })

  it("clicking 'Use this' calls onSelectSuggestion with the correct suggestion", () => {
    const onSelectSuggestion = jest.fn()
    render(
      <DayCard
        {...defaultProps}
        isExpanded={true}
        suggestions={MOCK_SUGGESTIONS}
        onSelectSuggestion={onSelectSuggestion}
      />,
    )
    const useButtons = screen.getAllByRole("button", { name: /use this/i })
    fireEvent.click(useButtons[0])
    expect(onSelectSuggestion).toHaveBeenCalledWith(MOCK_SUGGESTIONS[0])
  })

  it("shows suggestError message when suggestions failed", () => {
    render(
      <DayCard
        {...defaultProps}
        isExpanded={true}
        suggestError="Could not load suggestions"
      />,
    )
    expect(screen.getByText("Could not load suggestions")).toBeInTheDocument()
  })

  it("shows 'Booking required' indicator for booking_required suggestions", () => {
    render(
      <DayCard {...defaultProps} isExpanded={true} suggestions={MOCK_SUGGESTIONS} />,
    )
    expect(screen.getByText("Booking required")).toBeInTheDocument()
  })
})
