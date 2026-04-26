"use client"

import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { DemoModeProvider } from "@/components/DemoModeProvider"
import BookingRow from "@/components/BookingRow"
import type { Booking } from "@/lib/api"

const PENDING_BOOKING: Booking = {
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
}

const BOOKED_BOOKING: Booking = {
  ...PENDING_BOOKING,
  id: "b2",
  status: "booked",
  actual_cost: 4600,
}

const DEFAULT_PROPS = {
  booking: PENDING_BOOKING,
  onToggle: jest.fn(),
  onPatch: jest.fn(),
  onDelete: jest.fn(),
}

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

beforeEach(() => {
  jest.clearAllMocks()
  delete process.env.NEXT_PUBLIC_DEMO_MODE
})

afterEach(() => {
  delete process.env.NEXT_PUBLIC_DEMO_MODE
})

// ── Rendering ─────────────────────────────────────────────────────────────────

describe("BookingRow rendering", () => {
  it("renders the booking title", () => {
    render(<DemoModeProvider><BookingRow {...DEFAULT_PROPS} /></DemoModeProvider>)
    expect(screen.getByText("Flights SFO → LHR")).toBeInTheDocument()
  })

  it("renders subtitle when present", () => {
    render(<DemoModeProvider><BookingRow {...DEFAULT_PROPS} /></DemoModeProvider>)
    expect(screen.getByText("Jun 19 depart")).toBeInTheDocument()
  })

  it("shows unchecked checkbox for pending booking", () => {
    render(<DemoModeProvider><BookingRow {...DEFAULT_PROPS} /></DemoModeProvider>)
    expect(screen.getByRole("checkbox")).not.toBeChecked()
  })

  it("shows checked checkbox for booked booking", () => {
    render(
      <DemoModeProvider>
        <BookingRow {...DEFAULT_PROPS} booking={BOOKED_BOOKING} />
      </DemoModeProvider>,
    )
    expect(screen.getByRole("checkbox")).toBeChecked()
  })

  it("shows estimated cost when no actual cost", () => {
    render(<DemoModeProvider><BookingRow {...DEFAULT_PROPS} /></DemoModeProvider>)
    expect(screen.getByText("$4,800")).toBeInTheDocument()
  })

  it("shows actual cost when present", () => {
    render(
      <DemoModeProvider>
        <BookingRow {...DEFAULT_PROPS} booking={BOOKED_BOOKING} />
      </DemoModeProvider>,
    )
    expect(screen.getByText("$4,600")).toBeInTheDocument()
  })
})

// ── Status toggle ─────────────────────────────────────────────────────────────

describe("Status toggle", () => {
  it("calls onToggle with booking id and current status when checkbox clicked", async () => {
    const onToggle = jest.fn()
    render(
      <DemoModeProvider>
        <BookingRow {...DEFAULT_PROPS} onToggle={onToggle} />
      </DemoModeProvider>,
    )
    fireEvent.click(screen.getByRole("checkbox"))
    expect(onToggle).toHaveBeenCalledWith("b1", "pending")
  })
})

// ── Inline cost editing ───────────────────────────────────────────────────────

describe("Inline cost editing", () => {
  it("clicking cost shows an input", async () => {
    const user = userEvent.setup()
    render(<DemoModeProvider><BookingRow {...DEFAULT_PROPS} /></DemoModeProvider>)
    await user.click(screen.getByText("$4,800"))
    expect(screen.getByRole("spinbutton")).toBeInTheDocument()
  })

  it("blurring cost input calls onPatch with actual_cost", async () => {
    const onPatch = jest.fn()
    const user = userEvent.setup()
    render(
      <DemoModeProvider>
        <BookingRow {...DEFAULT_PROPS} onPatch={onPatch} />
      </DemoModeProvider>,
    )
    await user.click(screen.getByText("$4,800"))
    const input = screen.getByRole("spinbutton")
    await user.clear(input)
    await user.type(input, "4500")
    fireEvent.blur(input)
    await waitFor(() => {
      expect(onPatch).toHaveBeenCalledWith("b1", { actual_cost: 4500 })
    })
  })

  it("pressing Enter on cost input calls onPatch", async () => {
    const onPatch = jest.fn()
    const user = userEvent.setup()
    render(
      <DemoModeProvider>
        <BookingRow {...DEFAULT_PROPS} onPatch={onPatch} />
      </DemoModeProvider>,
    )
    await user.click(screen.getByText("$4,800"))
    const input = screen.getByRole("spinbutton")
    await user.clear(input)
    await user.type(input, "4500{Enter}")
    await waitFor(() => {
      expect(onPatch).toHaveBeenCalledWith("b1", { actual_cost: 4500 })
    })
  })
})

// ── Delete flow ───────────────────────────────────────────────────────────────

describe("Delete flow", () => {
  it("shows delete button in normal mode", () => {
    render(<DemoModeProvider><BookingRow {...DEFAULT_PROPS} /></DemoModeProvider>)
    expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument()
  })

  it("clicking delete shows confirmation", async () => {
    const user = userEvent.setup()
    render(<DemoModeProvider><BookingRow {...DEFAULT_PROPS} /></DemoModeProvider>)
    await user.click(screen.getByRole("button", { name: /delete/i }))
    expect(screen.getByRole("button", { name: /confirm/i })).toBeInTheDocument()
  })

  it("clicking cancel hides confirmation", async () => {
    const user = userEvent.setup()
    render(<DemoModeProvider><BookingRow {...DEFAULT_PROPS} /></DemoModeProvider>)
    await user.click(screen.getByRole("button", { name: /delete/i }))
    await user.click(screen.getByRole("button", { name: /cancel/i }))
    expect(screen.queryByRole("button", { name: /confirm/i })).not.toBeInTheDocument()
  })

  it("clicking confirm calls onDelete with booking id", async () => {
    const onDelete = jest.fn()
    const user = userEvent.setup()
    render(
      <DemoModeProvider>
        <BookingRow {...DEFAULT_PROPS} onDelete={onDelete} />
      </DemoModeProvider>,
    )
    await user.click(screen.getByRole("button", { name: /delete/i }))
    await user.click(screen.getByRole("button", { name: /confirm/i }))
    expect(onDelete).toHaveBeenCalledWith("b1")
  })
})

// ── Demo mode ─────────────────────────────────────────────────────────────────

describe("Demo mode", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "true"
  })

  it("delete button is hidden in demo mode", () => {
    render(<DemoModeProvider><BookingRow {...DEFAULT_PROPS} /></DemoModeProvider>)
    expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument()
  })

  it("checkbox is disabled in demo mode", () => {
    render(<DemoModeProvider><BookingRow {...DEFAULT_PROPS} /></DemoModeProvider>)
    expect(screen.getByRole("checkbox")).toBeDisabled()
  })
})
