import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import Page from "@/app/trip/page"
import { fetchBookings, patchBooking } from "@/lib/api"
import type { BookingsResponse } from "@/lib/api"

// ── Mocks ──────────────────────────────────────────────────────────────────────

jest.mock("@/lib/api", () => ({
  fetchBookings: jest.fn(),
  patchBookingStatus: jest.fn(),
  patchBooking: jest.fn(),
  createBooking: jest.fn(),
  deleteBooking: jest.fn(),
}))

jest.mock("@/components/ui/progress", () => ({
  Progress: ({ value }: { value: number }) => (
    <div data-testid="progress-bar" data-value={value} />
  ),
}))

jest.mock("@/components/UndoToast", () => ({
  __esModule: true,
  default: ({ message, onUndo, onExpire }: { message: string; onUndo: () => void; onExpire: () => void }) => (
    <div role="status" data-testid="undo-toast">
      <span>{message}</span>
      <button onClick={onUndo}>Undo</button>
      <button onClick={onExpire}>Expire</button>
    </div>
  ),
}))

jest.mock("@/components/ui/checkbox", () => ({
  Checkbox: ({
    checked,
    onCheckedChange,
  }: {
    checked: boolean
    onCheckedChange: () => void
  }) => (
    <input
      type="checkbox"
      role="checkbox"
      checked={checked}
      onChange={onCheckedChange}
      readOnly={false}
    />
  ),
}))

const mockFetchBookings = fetchBookings as jest.MockedFunction<
  typeof fetchBookings
>
const mockPatchBooking = patchBooking as jest.MockedFunction<
  typeof patchBooking
>

// ── Fixtures ───────────────────────────────────────────────────────────────────

const MOCK_RESPONSE: BookingsResponse = {
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
    {
      id: "b2",
      title: "Eurostar London → Paris",
      subtitle: "Jun 23",
      category: "trains",
      urgency: "now",
      status: "booked",
      estimated_cost: 400,
      actual_cost: 380,
      deadline: "This week",
      discount_code: "Standard Premier",
      card_tip: "Venture X",
      booked_at: "2026-04-01T00:00:00Z",
    },
  ],
  summary: {
    total_estimated: 5200,
    total_actual: 380,
    locked_in: 380,
    remaining: 4820,
    booked_count: 1,
    total_count: 2,
  },
}

beforeEach(() => {
  jest.clearAllMocks()
})

// ── Loading state ──────────────────────────────────────────────────────────────

describe("Loading state", () => {
  it("shows loading indicator while fetch is in flight", () => {
    mockFetchBookings.mockImplementation(() => new Promise(() => {}))
    render(<Page />)
    expect(screen.getByRole("status")).toBeInTheDocument()
  })

  it("loading indicator has descriptive label", () => {
    mockFetchBookings.mockImplementation(() => new Promise(() => {}))
    render(<Page />)
    expect(screen.getByRole("status")).toHaveAttribute(
      "aria-label",
      "Loading bookings",
    )
  })
})

// ── Error state ────────────────────────────────────────────────────────────────

describe("Error state", () => {
  it("shows error message when API is unreachable", async () => {
    mockFetchBookings.mockRejectedValue(new Error("Network error"))
    render(<Page />)
    await waitFor(() => {
      expect(
        screen.getByText(/could not load bookings/i),
      ).toBeInTheDocument()
    })
  })

  it("shows Retry button on error", async () => {
    mockFetchBookings.mockRejectedValue(new Error("Network error"))
    render(<Page />)
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /retry/i }),
      ).toBeInTheDocument()
    })
  })

  it("clicking Retry re-fetches and shows bookings on success", async () => {
    mockFetchBookings
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce(MOCK_RESPONSE)

    render(<Page />)
    const retryBtn = await screen.findByRole("button", { name: /retry/i })
    fireEvent.click(retryBtn)

    expect(await screen.findByText("Flights SFO → LHR")).toBeInTheDocument()
    expect(mockFetchBookings).toHaveBeenCalledTimes(2)
  })
})

// ── Success state ──────────────────────────────────────────────────────────────

describe("Success state", () => {
  beforeEach(() => {
    mockFetchBookings.mockResolvedValue(MOCK_RESPONSE)
  })

  it("renders booking titles from the API response", async () => {
    render(<Page />)
    expect(await screen.findByText("Flights SFO → LHR")).toBeInTheDocument()
    expect(screen.getByText("Eurostar London → Paris")).toBeInTheDocument()
  })

  it("renders summary count as booked/total", async () => {
    render(<Page />)
    await screen.findByText("Flights SFO → LHR")
    // Scope to the stat card via its label to avoid matching other elements
    expect(screen.getByText("Bookings done").closest("div")).toHaveTextContent("1/2")
  })

  it("renders locked-in amount from summary", async () => {
    render(<Page />)
    await screen.findByText("Flights SFO → LHR")
    // Scope to the stat card — "$380" also appears in the booking row cost
    expect(screen.getByText("Locked in").closest("div")).toHaveTextContent("$380")
  })

  it("renders discount code when present", async () => {
    render(<Page />)
    expect(await screen.findByText("Standard Premier")).toBeInTheDocument()
  })

  it("shows Booked badge for a booked booking", async () => {
    render(<Page />)
    await screen.findByText("Flights SFO → LHR")
    expect(screen.getByText("Booked")).toBeInTheDocument()
  })

  it("pending booking is unchecked", async () => {
    render(<Page />)
    await screen.findByText("Flights SFO → LHR")
    const checkboxes = screen.getAllByRole("checkbox")
    expect(checkboxes[0]).not.toBeChecked()
  })

  it("booked booking is checked", async () => {
    render(<Page />)
    await screen.findByText("Flights SFO → LHR")
    const checkboxes = screen.getAllByRole("checkbox")
    expect(checkboxes[1]).toBeChecked()
  })
})

// ── Toggle (PATCH) ─────────────────────────────────────────────────────────────

describe("Toggle booking status", () => {
  it("calls patchBooking with correct args when checkbox clicked", async () => {
    mockFetchBookings.mockResolvedValue(MOCK_RESPONSE)
    mockPatchBooking.mockResolvedValue({
      ...MOCK_RESPONSE.bookings[0],
      status: "booked",
    })

    render(<Page />)
    await screen.findByText("Flights SFO → LHR")

    const checkboxes = screen.getAllByRole("checkbox")
    fireEvent.click(checkboxes[0])

    await waitFor(() => {
      expect(mockPatchBooking).toHaveBeenCalledWith("b1", { status: "booked" })
    })
  })

  it("updates summary client-side after toggle without re-fetching", async () => {
    mockFetchBookings.mockResolvedValue(MOCK_RESPONSE)
    mockPatchBooking.mockResolvedValue({
      ...MOCK_RESPONSE.bookings[0],
      status: "booked",
    })

    render(<Page />)
    await screen.findByText("Flights SFO → LHR")

    const checkboxes = screen.getAllByRole("checkbox")
    fireEvent.click(checkboxes[0]) // toggle b1 pending → booked

    // booked count should update client-side: was 1/2, now 2/2
    await waitFor(() => {
      expect(screen.getByText("Bookings done").closest("div")).toHaveTextContent("2/2")
    })

    // fetchBookings called only once (on mount)
    expect(mockFetchBookings).toHaveBeenCalledTimes(1)
  })
})
