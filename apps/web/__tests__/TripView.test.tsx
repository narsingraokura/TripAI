import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { DemoModeProvider } from "@/components/DemoModeProvider"
import TripView from "@/components/TripView"
import { fetchBookings, patchBooking, createBooking, deleteBooking } from "@/lib/api"
import type { BookingsResponse } from "@/lib/api"

// ── Mocks ──────────────────────────────────────────────────────────────────────

jest.mock("@/lib/api", () => ({
  fetchBookings: jest.fn(),
  patchBooking: jest.fn(),
  createBooking: jest.fn(),
  deleteBooking: jest.fn(),
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
  }: {
    checked: boolean
    onCheckedChange?: () => void
    disabled?: boolean
    "aria-disabled"?: boolean
  }) => (
    <input
      type="checkbox"
      role="checkbox"
      checked={checked}
      onChange={onCheckedChange ?? (() => {})}
      disabled={disabled}
      aria-disabled={ariaDisabled}
    />
  ),
}))

// Mock UndoToast so tests can trigger onExpire without a 10s timer.
jest.mock("@/components/UndoToast", () => ({
  __esModule: true,
  default: ({
    message,
    onUndo,
    onExpire,
  }: {
    message: string
    onUndo: () => void
    onExpire: () => void
  }) => (
    <div role="status" data-testid="undo-toast">
      <span>{message}</span>
      <button onClick={onUndo}>Undo</button>
      <button onClick={onExpire} data-testid="expire-btn">Expire</button>
    </div>
  ),
}))

const mockFetchBookings = fetchBookings as jest.MockedFunction<typeof fetchBookings>
const mockPatchBooking = patchBooking as jest.MockedFunction<typeof patchBooking>
const mockCreateBooking = createBooking as jest.MockedFunction<typeof createBooking>
const mockDeleteBooking = deleteBooking as jest.MockedFunction<typeof deleteBooking>

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
      discount_code: null,
      card_tip: "Venture X",
      booked_at: "2026-04-01T00:00:00Z",
    },
  ],
  summary: {
    total_estimated: 5200,
    total_actual: 380,
    locked_in: 380,
    remaining: 24620,
    booked_count: 1,
    total_count: 2,
  },
}

beforeEach(() => {
  jest.clearAllMocks()
  delete process.env.NEXT_PUBLIC_DEMO_MODE
})

afterEach(() => {
  delete process.env.NEXT_PUBLIC_DEMO_MODE
})

function renderTripView() {
  return render(
    <DemoModeProvider>
      <TripView />
    </DemoModeProvider>,
  )
}

// ── Loading state ─────────────────────────────────────────────────────────────

describe("Loading state", () => {
  it("shows loading indicator while fetch is in flight", () => {
    mockFetchBookings.mockImplementation(() => new Promise(() => {}))
    renderTripView()
    expect(screen.getByRole("status")).toBeInTheDocument()
  })

  it("loading indicator has descriptive label", () => {
    mockFetchBookings.mockImplementation(() => new Promise(() => {}))
    renderTripView()
    expect(screen.getByRole("status")).toHaveAttribute("aria-label", "Loading bookings")
  })
})

// ── Error state ────────────────────────────────────────────────────────────────

describe("Error state", () => {
  it("shows error message when API is unreachable", async () => {
    mockFetchBookings.mockRejectedValue(new Error("Network error"))
    renderTripView()
    await waitFor(() => {
      expect(screen.getByText(/could not load bookings/i)).toBeInTheDocument()
    })
  })

  it("shows Retry button on error", async () => {
    mockFetchBookings.mockRejectedValue(new Error("Network error"))
    renderTripView()
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument()
    })
  })
})

// ── Success state ─────────────────────────────────────────────────────────────

describe("Success state", () => {
  beforeEach(() => {
    mockFetchBookings.mockResolvedValue(MOCK_RESPONSE)
  })

  it("renders booking titles", async () => {
    renderTripView()
    expect(await screen.findByText("Flights SFO → LHR")).toBeInTheDocument()
    expect(screen.getByText("Eurostar London → Paris")).toBeInTheDocument()
  })

  it("renders booked count stat", async () => {
    renderTripView()
    await screen.findByText("Flights SFO → LHR")
    expect(screen.getByText("Bookings done").closest("div")).toHaveTextContent("1/2")
  })

  it("renders locked-in stat", async () => {
    renderTripView()
    await screen.findByText("Flights SFO → LHR")
    expect(screen.getByText("Locked in").closest("div")).toHaveTextContent("$380")
  })
})

// ── Status toggle ─────────────────────────────────────────────────────────────

describe("Status toggle", () => {
  beforeEach(() => {
    mockFetchBookings.mockResolvedValue(MOCK_RESPONSE)
  })

  it("calls patchBooking with new status when checkbox clicked", async () => {
    mockPatchBooking.mockResolvedValue({ ...MOCK_RESPONSE.bookings[0], status: "booked" })
    renderTripView()
    await screen.findByText("Flights SFO → LHR")

    const checkboxes = screen.getAllByRole("checkbox")
    fireEvent.click(checkboxes[0]) // toggle b1 from pending to booked

    await waitFor(() => {
      expect(mockPatchBooking).toHaveBeenCalledWith("b1", { status: "booked" })
    })
  })

  it("updates booked count client-side after toggle (no re-fetch)", async () => {
    mockPatchBooking.mockResolvedValue({ ...MOCK_RESPONSE.bookings[0], status: "booked" })
    renderTripView()
    await screen.findByText("Flights SFO → LHR")

    const checkboxes = screen.getAllByRole("checkbox")
    fireEvent.click(checkboxes[0])

    // After toggle, b1 is now booked → booked count becomes 2/2
    await waitFor(() => {
      expect(screen.getByText("Bookings done").closest("div")).toHaveTextContent("2/2")
    })

    // fetchBookings should only have been called once (on mount)
    expect(mockFetchBookings).toHaveBeenCalledTimes(1)
  })

  it("updates locked-in client-side after toggling pending to booked", async () => {
    mockPatchBooking.mockResolvedValue({ ...MOCK_RESPONSE.bookings[0], status: "booked" })
    renderTripView()
    await screen.findByText("Flights SFO → LHR")

    const checkboxes = screen.getAllByRole("checkbox")
    fireEvent.click(checkboxes[0]) // b1 estimated_cost=4800 becomes booked

    await waitFor(() => {
      // locked_in was 380, now 380 + 4800 = 5180
      expect(screen.getByText("Locked in").closest("div")).toHaveTextContent("$5,180")
    })
  })

  it("reverts booked count on patchBooking failure", async () => {
    mockPatchBooking.mockRejectedValue(new Error("Network error"))
    renderTripView()
    await screen.findByText("Flights SFO → LHR")

    // Initially 1/2
    expect(screen.getByText("Bookings done").closest("div")).toHaveTextContent("1/2")

    const checkboxes = screen.getAllByRole("checkbox")
    fireEvent.click(checkboxes[0]) // toggle b1 pending→booked (optimistic)

    // Optimistic: 2/2
    await waitFor(() => {
      expect(screen.getByText("Bookings done").closest("div")).toHaveTextContent("2/2")
    })

    // Rollback: reverts to 1/2
    await waitFor(() => {
      expect(screen.getByText("Bookings done").closest("div")).toHaveTextContent("1/2")
    })
  })
})

// ── Delete with undo ──────────────────────────────────────────────────────────

describe("Delete with undo", () => {
  beforeEach(() => {
    mockFetchBookings.mockResolvedValue(MOCK_RESPONSE)
  })

  it("calls deleteBooking immediately on confirm", async () => {
    mockDeleteBooking.mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderTripView()
    await screen.findByText("Flights SFO → LHR")

    const deleteButtons = screen.getAllByRole("button", { name: /delete/i })
    await user.click(deleteButtons[0])
    await user.click(screen.getByRole("button", { name: /confirm/i }))

    // deleteBooking fires on confirm — not deferred to toast expiry
    await waitFor(() => {
      expect(mockDeleteBooking).toHaveBeenCalledWith("b1")
    })
  })

  it("removes booking from list and shows UndoToast after delete confirmed", async () => {
    mockDeleteBooking.mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderTripView()
    await screen.findByText("Flights SFO → LHR")

    const deleteButtons = screen.getAllByRole("button", { name: /delete/i })
    await user.click(deleteButtons[0])
    await user.click(screen.getByRole("button", { name: /confirm/i }))

    await waitFor(() => {
      expect(screen.queryByText("Flights SFO → LHR")).not.toBeInTheDocument()
      expect(screen.getByTestId("undo-toast")).toBeInTheDocument()
    })
  })

  it("calls createBooking on undo click", async () => {
    mockDeleteBooking.mockResolvedValue(undefined)
    mockCreateBooking.mockResolvedValue(MOCK_RESPONSE.bookings[0])
    const user = userEvent.setup()
    renderTripView()
    await screen.findByText("Flights SFO → LHR")

    const deleteButtons = screen.getAllByRole("button", { name: /delete/i })
    await user.click(deleteButtons[0])
    await user.click(screen.getByRole("button", { name: /confirm/i }))

    await waitFor(() => expect(screen.getByTestId("undo-toast")).toBeInTheDocument())

    await user.click(screen.getByRole("button", { name: /^undo$/i }))

    await waitFor(() => {
      expect(mockCreateBooking).toHaveBeenCalledTimes(1)
    })
  })

  it("restores booking when Undo is clicked", async () => {
    mockDeleteBooking.mockResolvedValue(undefined)
    mockCreateBooking.mockResolvedValue(MOCK_RESPONSE.bookings[0])
    const user = userEvent.setup()
    renderTripView()
    await screen.findByText("Flights SFO → LHR")

    const deleteButtons = screen.getAllByRole("button", { name: /delete/i })
    await user.click(deleteButtons[0])
    await user.click(screen.getByRole("button", { name: /confirm/i }))

    await waitFor(() => {
      expect(screen.getByTestId("undo-toast")).toBeInTheDocument()
    })

    await user.click(screen.getByRole("button", { name: /^undo$/i }))

    await waitFor(() => {
      expect(screen.getByText("Flights SFO → LHR")).toBeInTheDocument()
      expect(screen.queryByTestId("undo-toast")).not.toBeInTheDocument()
    })
  })

  it("shows error when createBooking fails on undo", async () => {
    mockDeleteBooking.mockResolvedValue(undefined)
    mockCreateBooking.mockRejectedValue(new Error("Network error"))
    const user = userEvent.setup()
    renderTripView()
    await screen.findByText("Flights SFO → LHR")

    const deleteButtons = screen.getAllByRole("button", { name: /delete/i })
    await user.click(deleteButtons[0])
    await user.click(screen.getByRole("button", { name: /confirm/i }))

    await waitFor(() => expect(screen.getByTestId("undo-toast")).toBeInTheDocument())

    await user.click(screen.getByRole("button", { name: /^undo$/i }))

    await waitFor(() => {
      expect(screen.getByText(/could not undo/i)).toBeInTheDocument()
    })
  })
})

// ── Add booking ───────────────────────────────────────────────────────────────

describe("Add booking", () => {
  beforeEach(() => {
    mockFetchBookings.mockResolvedValue(MOCK_RESPONSE)
  })

  it("shows Add Booking button", async () => {
    renderTripView()
    await screen.findByText("Flights SFO → LHR")
    expect(screen.getByRole("button", { name: /add booking/i })).toBeInTheDocument()
  })

  it("clicking Add Booking opens the form", async () => {
    const user = userEvent.setup()
    renderTripView()
    await screen.findByText("Flights SFO → LHR")

    // The main "Add Booking" trigger button
    const addBtns = screen.getAllByRole("button", { name: /add booking/i })
    await user.click(addBtns[0])
    expect(screen.getByLabelText("Title")).toBeInTheDocument()
  })

  it("submitting the form calls createBooking and adds booking to list", async () => {
    const newBooking = {
      id: "b-new",
      title: "Milan Duomo",
      subtitle: null,
      category: "activities",
      urgency: "soon" as const,
      status: "pending" as const,
      estimated_cost: 80,
      actual_cost: null,
      deadline: null,
      discount_code: null,
      card_tip: null,
      booked_at: null,
    }
    mockCreateBooking.mockResolvedValue(newBooking)

    const user = userEvent.setup()
    renderTripView()
    await screen.findByText("Flights SFO → LHR")

    const addBtns = screen.getAllByRole("button", { name: /add booking/i })
    await user.click(addBtns[0])

    await user.type(screen.getByLabelText("Title"), "Milan Duomo")
    await user.clear(screen.getByLabelText(/estimated cost/i))
    await user.type(screen.getByLabelText(/estimated cost/i), "80")

    const submitBtns = screen.getAllByRole("button", { name: /add booking/i })
    await user.click(submitBtns[submitBtns.length - 1]) // submit button in form

    await waitFor(() => {
      expect(mockCreateBooking).toHaveBeenCalledTimes(1)
      expect(screen.getByText("Milan Duomo")).toBeInTheDocument()
    })
  })
})

// ── Summary recalculation ─────────────────────────────────────────────────────

describe("Client-side summary recalculation", () => {
  it("does not re-fetch bookings after status toggle", async () => {
    mockFetchBookings.mockResolvedValue(MOCK_RESPONSE)
    mockPatchBooking.mockResolvedValue({ ...MOCK_RESPONSE.bookings[0], status: "booked" })

    renderTripView()
    await screen.findByText("Flights SFO → LHR")

    const checkboxes = screen.getAllByRole("checkbox")
    fireEvent.click(checkboxes[0])

    await waitFor(() => {
      expect(mockPatchBooking).toHaveBeenCalledTimes(1)
    })

    expect(mockFetchBookings).toHaveBeenCalledTimes(1)
  })
})
