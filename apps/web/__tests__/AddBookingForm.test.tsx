import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import AddBookingForm from "@/components/AddBookingForm"

const DEFAULT_PROPS = {
  submitting: false,
  error: null,
  onAdd: jest.fn(),
  onCancel: jest.fn(),
}

beforeEach(() => {
  jest.clearAllMocks()
})

// ── Rendering ─────────────────────────────────────────────────────────────────

describe("AddBookingForm rendering", () => {
  it("renders title input", () => {
    render(<AddBookingForm {...DEFAULT_PROPS} />)
    expect(screen.getByLabelText("Title")).toBeInTheDocument()
  })

  it("renders category dropdown", () => {
    render(<AddBookingForm {...DEFAULT_PROPS} />)
    expect(screen.getByLabelText(/category/i)).toBeInTheDocument()
  })

  it("renders urgency dropdown", () => {
    render(<AddBookingForm {...DEFAULT_PROPS} />)
    expect(screen.getByLabelText(/urgency/i)).toBeInTheDocument()
  })

  it("renders estimated cost input", () => {
    render(<AddBookingForm {...DEFAULT_PROPS} />)
    expect(screen.getByLabelText(/estimated cost/i)).toBeInTheDocument()
  })

  it("renders Add Booking submit button", () => {
    render(<AddBookingForm {...DEFAULT_PROPS} />)
    expect(screen.getByRole("button", { name: /add booking/i })).toBeInTheDocument()
  })

  it("renders Cancel button", () => {
    render(<AddBookingForm {...DEFAULT_PROPS} />)
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument()
  })
})

// ── Cancel ────────────────────────────────────────────────────────────────────

describe("Cancel", () => {
  it("clicking Cancel calls onCancel", async () => {
    const onCancel = jest.fn()
    const user = userEvent.setup()
    render(<AddBookingForm {...DEFAULT_PROPS} onCancel={onCancel} />)
    await user.click(screen.getByRole("button", { name: /cancel/i }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})

// ── Validation ────────────────────────────────────────────────────────────────

describe("Validation", () => {
  it("submit button is disabled when title is empty", () => {
    render(<AddBookingForm {...DEFAULT_PROPS} />)
    expect(screen.getByRole("button", { name: /add booking/i })).toBeDisabled()
  })

  it("submit button is disabled when estimated_cost is 0", async () => {
    const user = userEvent.setup()
    render(<AddBookingForm {...DEFAULT_PROPS} />)
    await user.type(screen.getByLabelText("Title"), "Test")
    // cost defaults to 0
    expect(screen.getByRole("button", { name: /add booking/i })).toBeDisabled()
  })
})

// ── Submission ────────────────────────────────────────────────────────────────

describe("Submission", () => {
  it("submitting with valid data calls onAdd with correct fields", async () => {
    const onAdd = jest.fn()
    const user = userEvent.setup()
    render(<AddBookingForm {...DEFAULT_PROPS} onAdd={onAdd} />)

    await user.type(screen.getByLabelText("Title"), "Test Hotel")
    await user.clear(screen.getByLabelText(/estimated cost/i))
    await user.type(screen.getByLabelText(/estimated cost/i), "500")

    await user.click(screen.getByRole("button", { name: /add booking/i }))

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledTimes(1)
      const arg = onAdd.mock.calls[0][0] as Record<string, unknown>
      expect(arg.title).toBe("Test Hotel")
      expect(arg.estimated_cost).toBe(500)
    })
  })

  it("submit button is disabled while submitting", () => {
    render(<AddBookingForm {...DEFAULT_PROPS} submitting={true} />)
    expect(screen.getByRole("button", { name: /add booking/i })).toBeDisabled()
  })

  it("shows error when error prop is set", () => {
    render(<AddBookingForm {...DEFAULT_PROPS} error="Something went wrong" />)
    expect(screen.getByText("Something went wrong")).toBeInTheDocument()
  })
})
