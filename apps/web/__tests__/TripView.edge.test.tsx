/**
 * Edge-case tests for TripView:
 * - Status toggle booked → pending decreases locked_in
 * - PATCH (handlePatch) rollback on API failure
 * - New booking appears in the correct urgency section
 * - locked_in / remaining formula assertion (not a hardcoded scalar)
 */
import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { DemoModeProvider } from "@/components/DemoModeProvider"
import TripView from "@/components/TripView"
import { fetchBookings, patchBooking, createBooking, deleteBooking } from "@/lib/api"
import type { BookingsResponse } from "@/lib/api"

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

const BOOKED_BOOKING = {
  id: "b1",
  title: "Eurostar London → Paris",
  subtitle: "Jun 23",
  category: "trains" as const,
  urgency: "now" as const,
  status: "booked" as const,
  estimated_cost: 400,
  actual_cost: 380,
  deadline: "This week",
  discount_code: null,
  card_tip: "Venture X",
  booked_at: "2026-04-01T00:00:00Z",
}

const PENDING_BOOKING = {
  id: "b2",
  title: "Flights SFO → LHR",
  subtitle: "Jun 19",
  category: "flights" as const,
  urgency: "fire" as const,
  status: "pending" as const,
  estimated_cost: 4800,
  actual_cost: null,
  deadline: "This week",
  discount_code: null,
  card_tip: "Amex Gold",
  booked_at: null,
}

const MOCK_RESPONSE: BookingsResponse = {
  bookings: [BOOKED_BOOKING, PENDING_BOOKING],
  summary: {
    total_estimated: 5200,
    total_actual: 380,
    locked_in: 380,       // only BOOKED_BOOKING is booked; actual_cost = 380
    remaining: 24620,
    booked_count: 1,
    total_count: 2,
  },
}

const BUDGET_CAP = 25_000

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

// ── Toggle booked → pending decreases locked_in ───────────────────────────────

describe("Status toggle: booked → pending", () => {
  it("decreases locked-in when a booked booking is toggled to pending", async () => {
    mockFetchBookings.mockResolvedValue(MOCK_RESPONSE)
    // Toggle returns the booking set to pending
    mockPatchBooking.mockResolvedValue({ ...BOOKED_BOOKING, status: "pending" })

    renderTripView()
    await screen.findByText("Eurostar London → Paris")

    // Before toggle: locked_in is 380 (actual_cost of b1)
    expect(screen.getByText("Locked in").closest("div")).toHaveTextContent("$380")

    const checkboxes = screen.getAllByRole("checkbox")
    // BOOKED_BOOKING is "Done" section — it should be the checked one
    const checkedBox = checkboxes.find((cb) => (cb as HTMLInputElement).checked)!
    fireEvent.click(checkedBox)

    // After toggle to pending: b1 no longer booked → locked_in = 0
    await waitFor(() => {
      expect(screen.getByText("Locked in").closest("div")).toHaveTextContent("$0")
    })
  })

  it("remaining increases when a booked booking is toggled to pending", async () => {
    mockFetchBookings.mockResolvedValue(MOCK_RESPONSE)
    mockPatchBooking.mockResolvedValue({ ...BOOKED_BOOKING, status: "pending" })

    renderTripView()
    await screen.findByText("Eurostar London → Paris")

    const checkboxes = screen.getAllByRole("checkbox")
    const checkedBox = checkboxes.find((cb) => (cb as HTMLInputElement).checked)!
    fireEvent.click(checkedBox)

    // remaining = BUDGET_CAP - locked_in = 25000 - 0 = 25000
    await waitFor(() => {
      expect(screen.getByText("Remaining").closest("div")).toHaveTextContent(
        `$${BUDGET_CAP.toLocaleString()}`,
      )
    })
  })
})

// ── PATCH (cost edit) rollback on API failure ─────────────────────────────────

describe("Cost patch rollback on API failure", () => {
  it("reverts the displayed cost when patchBooking rejects after cost edit", async () => {
    mockFetchBookings.mockResolvedValue(MOCK_RESPONSE)
    mockPatchBooking.mockRejectedValue(new Error("Network error"))

    const user = userEvent.setup()
    renderTripView()
    await screen.findByText("Eurostar London → Paris")

    // Click the cost button inside the booking row (not the stat card)
    // The cost button is a <button> role element, the stat card is a <p>
    const costButtons = screen.getAllByRole("button", { name: /^\$/ })
    const costBtn = costButtons.find((b) => b.textContent?.replace(/[$,]/g, "") === "380")!
    await user.click(costBtn)

    const input = screen.getByRole("spinbutton")
    await user.clear(input)
    await user.type(input, "999")
    fireEvent.blur(input)

    // Optimistically updates to $999 then rolls back to $380
    await waitFor(() => {
      expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument()
    })
    // After rollback the original cost button is shown again
    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /^\$/ }).some(
        (b) => b.textContent?.replace(/[$,]/g, "") === "380"
      )).toBe(true)
    })
  })

  it("reverts locked-in when patchBooking rejects after cost edit", async () => {
    mockFetchBookings.mockResolvedValue(MOCK_RESPONSE)
    mockPatchBooking.mockRejectedValue(new Error("Network error"))

    const user = userEvent.setup()
    renderTripView()
    await screen.findByText("Eurostar London → Paris")

    const costButtons = screen.getAllByRole("button", { name: /^\$/ })
    const costBtn = costButtons.find((b) => b.textContent?.replace(/[$,]/g, "") === "380")!
    await user.click(costBtn)

    const input = screen.getByRole("spinbutton")
    await user.clear(input)
    await user.type(input, "999")
    fireEvent.blur(input)

    // After rollback: locked_in reverts to 380
    await waitFor(() => {
      expect(screen.getByText("Locked in").closest("div")).toHaveTextContent("$380")
    })
  })
})

// ── New booking appears in correct urgency section ────────────────────────────

describe("New booking urgency section placement", () => {
  it("a new 'fire' urgency booking appears in 'Book immediately' section", async () => {
    mockFetchBookings.mockResolvedValue({
      ...MOCK_RESPONSE,
      // Start with only the booked booking so sections are predictable
      bookings: [BOOKED_BOOKING],
      summary: { ...MOCK_RESPONSE.summary, booked_count: 1, total_count: 1 },
    })
    const fireBooking = {
      ...PENDING_BOOKING,
      id: "b-fire",
      title: "Urgent New Booking",
      urgency: "fire" as const,
    }
    mockCreateBooking.mockResolvedValue(fireBooking)

    const user = userEvent.setup()
    renderTripView()
    await screen.findByText("Eurostar London → Paris")

    await user.click(screen.getByRole("button", { name: /add booking/i }))
    await user.type(screen.getByLabelText("Title"), "Urgent New Booking")
    await user.clear(screen.getByLabelText(/estimated cost/i))
    await user.type(screen.getByLabelText(/estimated cost/i), "4800")

    // Select fire urgency (the default may differ; set it explicitly)
    const urgencySelect = screen.getByLabelText(/urgency/i)
    await user.selectOptions(urgencySelect, "fire")

    const submitBtns = screen.getAllByRole("button", { name: /add booking/i })
    await user.click(submitBtns[submitBtns.length - 1])

    await waitFor(() => {
      expect(screen.getByText("Urgent New Booking")).toBeInTheDocument()
    })

    // "Book immediately" section must contain the new booking
    const section = screen.getByText("Book immediately").closest("div")!
    expect(section).toHaveTextContent("Urgent New Booking")
  })

  it("a new 'later' urgency booking appears in 'No rush' section, not 'Book immediately'", async () => {
    mockFetchBookings.mockResolvedValue({
      ...MOCK_RESPONSE,
      bookings: [BOOKED_BOOKING],
      summary: { ...MOCK_RESPONSE.summary, booked_count: 1, total_count: 1 },
    })
    const laterBooking = {
      ...PENDING_BOOKING,
      id: "b-later",
      title: "Relaxed New Booking",
      urgency: "later" as const,
    }
    mockCreateBooking.mockResolvedValue(laterBooking)

    const user = userEvent.setup()
    renderTripView()
    await screen.findByText("Eurostar London → Paris")

    await user.click(screen.getByRole("button", { name: /add booking/i }))
    await user.type(screen.getByLabelText("Title"), "Relaxed New Booking")
    await user.clear(screen.getByLabelText(/estimated cost/i))
    await user.type(screen.getByLabelText(/estimated cost/i), "50")

    const urgencySelect = screen.getByLabelText(/urgency/i)
    await user.selectOptions(urgencySelect, "later")

    const submitBtns = screen.getAllByRole("button", { name: /add booking/i })
    await user.click(submitBtns[submitBtns.length - 1])

    await waitFor(() => {
      expect(screen.getByText("Relaxed New Booking")).toBeInTheDocument()
    })

    // "No rush" appears as both a section heading and a badge label; take the first (heading)
    const noRushHeadings = screen.getAllByText("No rush")
    const noRushSection = noRushHeadings[0].closest("div")!
    expect(noRushSection).toHaveTextContent("Relaxed New Booking")

    expect(screen.queryByText("Book immediately")).not.toBeInTheDocument()
  })
})

// ── locked_in / remaining formula assertions ──────────────────────────────────

describe("Summary formula: locked_in and remaining", () => {
  it("locked_in equals sum of actual_cost for booked bookings (formula, not scalar)", async () => {
    // Two booked bookings: one with actual_cost, one without
    const b1 = { ...BOOKED_BOOKING, id: "b1", actual_cost: 380 }     // uses actual_cost
    const b2 = { ...BOOKED_BOOKING, id: "b2", title: "Hotel Paris", actual_cost: null, estimated_cost: 500 } // falls back to estimated_cost
    mockFetchBookings.mockResolvedValue({
      bookings: [b1, b2],
      summary: {
        total_estimated: 900,
        total_actual: 380,
        locked_in: 880,   // 380 + 500
        remaining: BUDGET_CAP - 880,
        booked_count: 2,
        total_count: 2,
      },
    })

    renderTripView()
    await screen.findByText("Eurostar London → Paris")

    // Extract the displayed values to assert formula relationship
    const lockedEl = screen.getByText("Locked in").closest("div")!
    const remainingEl = screen.getByText("Remaining").closest("div")!

    // Parse displayed integers (strip $ and ,)
    const lockedInDisplayed = parseInt(lockedEl.textContent!.replace(/[$,]/g, "").match(/\d+/)![0])
    const remainingDisplayed = parseInt(remainingEl.textContent!.replace(/[$,]/g, "").match(/\d+/)![0])

    // Formula: remaining = BUDGET_CAP - locked_in
    expect(remainingDisplayed).toBe(BUDGET_CAP - lockedInDisplayed)

    // Formula: locked_in = actual_cost(b1) + estimated_cost(b2) = 380 + 500 = 880
    expect(lockedInDisplayed).toBe(380 + 500)
  })

  it("remaining equals BUDGET_CAP - locked_in after a toggle (formula holds post-update)", async () => {
    mockFetchBookings.mockResolvedValue(MOCK_RESPONSE)
    mockPatchBooking.mockResolvedValue({ ...PENDING_BOOKING, status: "booked" })

    renderTripView()
    await screen.findByText("Flights SFO → LHR")

    // Toggle PENDING_BOOKING to booked (estimated_cost 4800, no actual_cost)
    const checkboxes = screen.getAllByRole("checkbox")
    const uncheckedBox = checkboxes.find((cb) => !(cb as HTMLInputElement).checked)!
    fireEvent.click(uncheckedBox)

    await waitFor(() => {
      const lockedEl = screen.getByText("Locked in").closest("div")!
      const remainingEl = screen.getByText("Remaining").closest("div")!

      const locked = parseInt(lockedEl.textContent!.replace(/[$,]/g, "").match(/\d+/)![0])
      const remaining = parseInt(remainingEl.textContent!.replace(/[$,]/g, "").match(/\d+/)![0])

      // Formula must hold regardless of which bookings are booked
      expect(remaining).toBe(BUDGET_CAP - locked)
    })
  })
})
