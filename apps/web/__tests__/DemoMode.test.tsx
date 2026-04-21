import { render, screen } from "@testing-library/react"
import { DemoModeProvider, useIsDemo } from "@/components/DemoModeProvider"
import { DemoBanner } from "@/components/DemoBanner"
import DayCard from "@/components/itinerary/DayCard"
import ItineraryView from "@/components/itinerary/ItineraryView"
import Page from "@/app/trip/page"
import { fetchBookings, fetchItinerary } from "@/lib/api"
import type { ItineraryDay, BookingsResponse } from "@/lib/api"

// ── Mocks ──────────────────────────────────────────────────────────────────────

jest.mock("@/lib/api", () => ({
  fetchBookings: jest.fn(),
  patchBookingStatus: jest.fn(),
  fetchItinerary: jest.fn(),
  patchItineraryDay: jest.fn(),
  deleteItineraryDay: jest.fn(),
  createItineraryDay: jest.fn(),
  fetchSuggestions: jest.fn(),
}))

jest.mock("@/components/ui/progress", () => ({
  Progress: ({ value }: { value: number }) => (
    <div data-testid="progress-bar" data-value={value} />
  ),
}))

jest.mock("@/components/ui/checkbox", () => ({
  Checkbox: ({
    checked,
    onCheckedChange,
    disabled,
    "aria-disabled": ariaDisabled,
    className,
  }: {
    checked: boolean
    onCheckedChange?: () => void
    disabled?: boolean
    "aria-disabled"?: boolean
    className?: string
  }) => (
    <input
      type="checkbox"
      role="checkbox"
      checked={checked}
      onChange={onCheckedChange ?? (() => {})}
      disabled={disabled}
      aria-disabled={ariaDisabled}
      className={className}
    />
  ),
}))

const mockFetchBookings = fetchBookings as jest.MockedFunction<typeof fetchBookings>
const mockFetchItinerary = fetchItinerary as jest.MockedFunction<typeof fetchItinerary>

// ── Fixtures ───────────────────────────────────────────────────────────────────

function TestIsDemo() {
  const isDemo = useIsDemo()
  return <div data-testid="is-demo">{String(isDemo)}</div>
}

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

const DAY_CARD_PROPS = {
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

const MOCK_BOOKING_RESPONSE: BookingsResponse = {
  bookings: [
    {
      id: "b1",
      title: "Flights SFO → LHR",
      subtitle: "Jun 19 depart",
      category: "flights",
      urgency: "fire",
      status: "pending",
      estimated_cost: 4800,
      actual_cost: null,
      deadline: "This week",
      discount_code: null,
      card_tip: "Amex Gold",
      booked_at: null,
    },
  ],
  summary: {
    total_estimated: 4800,
    total_actual: 0,
    locked_in: 0,
    remaining: 4800,
    booked_count: 0,
    total_count: 1,
  },
}

// ── Setup / teardown ───────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks()
  delete process.env.NEXT_PUBLIC_DEMO_MODE
})

afterEach(() => {
  delete process.env.NEXT_PUBLIC_DEMO_MODE
})

// ── useIsDemo() context ────────────────────────────────────────────────────────

describe("useIsDemo()", () => {
  it("returns true when NEXT_PUBLIC_DEMO_MODE is 'true'", () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "true"
    render(
      <DemoModeProvider>
        <TestIsDemo />
      </DemoModeProvider>,
    )
    expect(screen.getByTestId("is-demo")).toHaveTextContent("true")
  })

  it("returns false when NEXT_PUBLIC_DEMO_MODE is unset", () => {
    render(
      <DemoModeProvider>
        <TestIsDemo />
      </DemoModeProvider>,
    )
    expect(screen.getByTestId("is-demo")).toHaveTextContent("false")
  })

  it("returns false when NEXT_PUBLIC_DEMO_MODE is 'false'", () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "false"
    render(
      <DemoModeProvider>
        <TestIsDemo />
      </DemoModeProvider>,
    )
    expect(screen.getByTestId("is-demo")).toHaveTextContent("false")
  })
})

// ── DemoBanner ─────────────────────────────────────────────────────────────────

describe("DemoBanner", () => {
  it("shows 'Demo mode' and 'view only' text when demo mode is on", () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "true"
    render(
      <DemoModeProvider>
        <DemoBanner />
      </DemoModeProvider>,
    )
    expect(screen.getByText(/demo mode/i)).toBeInTheDocument()
    expect(screen.getByText(/view only/i)).toBeInTheDocument()
  })

  it("renders nothing when demo mode is off", () => {
    render(
      <DemoModeProvider>
        <DemoBanner />
      </DemoModeProvider>,
    )
    expect(screen.queryByText(/demo mode/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/view only/i)).not.toBeInTheDocument()
  })
})

// ── Booking checkboxes ─────────────────────────────────────────────────────────

describe("Booking checkboxes in demo mode", () => {
  it("checkbox is disabled in demo mode", async () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "true"
    mockFetchBookings.mockResolvedValue(MOCK_BOOKING_RESPONSE)
    render(
      <DemoModeProvider>
        <Page />
      </DemoModeProvider>,
    )
    await screen.findByText("Flights SFO → LHR")
    expect(screen.getByRole("checkbox")).toBeDisabled()
  })

  it("checkbox has aria-disabled='true' in demo mode", async () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "true"
    mockFetchBookings.mockResolvedValue(MOCK_BOOKING_RESPONSE)
    render(
      <DemoModeProvider>
        <Page />
      </DemoModeProvider>,
    )
    await screen.findByText("Flights SFO → LHR")
    expect(screen.getByRole("checkbox")).toHaveAttribute("aria-disabled", "true")
  })

  it("checkbox is not disabled outside demo mode", async () => {
    mockFetchBookings.mockResolvedValue(MOCK_BOOKING_RESPONSE)
    render(
      <DemoModeProvider>
        <Page />
      </DemoModeProvider>,
    )
    await screen.findByText("Flights SFO → LHR")
    expect(screen.getByRole("checkbox")).not.toBeDisabled()
  })
})

// ── DayCard write controls ─────────────────────────────────────────────────────

describe("DayCard write controls in demo mode", () => {
  it("Edit button is hidden when demo mode is on", () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "true"
    render(
      <DemoModeProvider>
        <DayCard {...DAY_CARD_PROPS} />
      </DemoModeProvider>,
    )
    expect(screen.queryByRole("button", { name: /edit/i })).not.toBeInTheDocument()
  })

  it("'Suggest alternatives' button is hidden when demo mode is on", () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "true"
    render(
      <DemoModeProvider>
        <DayCard {...DAY_CARD_PROPS} />
      </DemoModeProvider>,
    )
    expect(
      screen.queryByRole("button", { name: /suggest alternatives/i }),
    ).not.toBeInTheDocument()
  })

  it("Remove button is hidden when demo mode is on", () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "true"
    render(
      <DemoModeProvider>
        <DayCard {...DAY_CARD_PROPS} />
      </DemoModeProvider>,
    )
    expect(screen.queryByRole("button", { name: /remove/i })).not.toBeInTheDocument()
  })

  it("day card expand/collapse still works in demo mode", () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "true"
    render(
      <DemoModeProvider>
        <DayCard {...DAY_CARD_PROPS} isExpanded={true} />
      </DemoModeProvider>,
    )
    expect(
      screen.getByText("Arrive at Heathrow, jet lag buffer day"),
    ).toBeInTheDocument()
  })

  it("write controls are visible outside demo mode", () => {
    render(
      <DemoModeProvider>
        <DayCard {...DAY_CARD_PROPS} />
      </DemoModeProvider>,
    )
    expect(screen.getByRole("button", { name: /edit/i })).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /suggest alternatives/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /remove/i })).toBeInTheDocument()
  })
})

// ── ItineraryView add button ───────────────────────────────────────────────────

describe("ItineraryView add button in demo mode", () => {
  it("'+ Add day' button is hidden in demo mode", async () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "true"
    mockFetchItinerary.mockResolvedValue([MOCK_DAY])
    render(
      <DemoModeProvider>
        <ItineraryView />
      </DemoModeProvider>,
    )
    await screen.findByText("Arrive LHR")
    expect(
      screen.queryByRole("button", { name: /add day/i }),
    ).not.toBeInTheDocument()
  })

  it("'+ Add day' button is visible outside demo mode", async () => {
    mockFetchItinerary.mockResolvedValue([MOCK_DAY])
    render(
      <DemoModeProvider>
        <ItineraryView />
      </DemoModeProvider>,
    )
    await screen.findByText("Arrive LHR")
    expect(
      screen.getByRole("button", { name: /add day/i }),
    ).toBeInTheDocument()
  })
})
