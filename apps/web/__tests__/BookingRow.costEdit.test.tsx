/**
 * Edge-case tests for BookingRow inline cost editing.
 * Focus: the guard in handleCostSave — `!isNaN(num) && num >= 0`.
 * These tests assert that onPatch is NOT called for invalid inputs,
 * and that Escape closes the editor silently.
 */
import { render, screen, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { DemoModeProvider } from "@/components/DemoModeProvider"
import BookingRow from "@/components/BookingRow"
import type { Booking } from "@/lib/api"

const BOOKING: Booking = {
  id: "b1",
  title: "Louvre Entry",
  subtitle: "Jun 25 9am",
  category: "activities",
  urgency: "soon",
  status: "pending",
  estimated_cost: 100,
  actual_cost: null,
  deadline: "Late April",
  discount_code: null,
  card_tip: null,
  booked_at: null,
}

jest.mock("@/components/ui/checkbox", () => ({
  Checkbox: ({
    checked,
    onCheckedChange,
  }: {
    checked: boolean
    onCheckedChange?: () => void
  }) => (
    <input
      type="checkbox"
      role="checkbox"
      checked={checked}
      onChange={onCheckedChange ?? (() => {})}
    />
  ),
}))

beforeEach(() => {
  jest.clearAllMocks()
  delete process.env.NEXT_PUBLIC_DEMO_MODE
})

function renderRow(onPatch = jest.fn()) {
  render(
    <DemoModeProvider>
      <BookingRow
        booking={BOOKING}
        onToggle={jest.fn()}
        onPatch={onPatch}
        onDelete={jest.fn()}
      />
    </DemoModeProvider>,
  )
  return onPatch
}

// ── Negative cost ─────────────────────────────────────────────────────────────

describe("Inline cost edit: negative number", () => {
  it("does NOT call onPatch when a negative value is entered and blurred", async () => {
    const onPatch = renderRow()
    const user = userEvent.setup()
    await user.click(screen.getByText("$100"))

    const input = screen.getByRole("spinbutton")
    await user.clear(input)
    await user.type(input, "-50")
    fireEvent.blur(input)

    expect(onPatch).not.toHaveBeenCalled()
  })

  it("closes the editor after entering a negative value and blurring", async () => {
    renderRow()
    const user = userEvent.setup()
    await user.click(screen.getByText("$100"))

    const input = screen.getByRole("spinbutton")
    await user.clear(input)
    await user.type(input, "-50")
    fireEvent.blur(input)

    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument()
  })
})

// ── Non-numeric cost ──────────────────────────────────────────────────────────

describe("Inline cost edit: non-numeric (NaN)", () => {
  it("does NOT call onPatch when a non-numeric value is entered and blurred", async () => {
    const onPatch = renderRow()
    const user = userEvent.setup()

    // Open the editor; type something that doesn't produce a valid number
    // (clear to empty first — parseFloat("") is NaN)
    await user.click(screen.getByText("$100"))
    const input = screen.getByRole("spinbutton")
    await user.clear(input)
    fireEvent.blur(input)

    expect(onPatch).not.toHaveBeenCalled()
  })
})

// ── Zero cost ─────────────────────────────────────────────────────────────────

describe("Inline cost edit: zero", () => {
  it("calls onPatch with 0 — zero is a valid (non-negative) cost", async () => {
    const onPatch = renderRow()
    const user = userEvent.setup()
    await user.click(screen.getByText("$100"))

    const input = screen.getByRole("spinbutton")
    await user.clear(input)
    await user.type(input, "0")
    fireEvent.blur(input)

    expect(onPatch).toHaveBeenCalledWith("b1", { actual_cost: 0 })
  })
})

// ── Escape closes editor without saving ───────────────────────────────────────

describe("Inline cost edit: Escape key", () => {
  it("closes the editor on Escape without calling onPatch", async () => {
    const onPatch = renderRow()
    const user = userEvent.setup()
    await user.click(screen.getByText("$100"))

    const input = screen.getByRole("spinbutton")
    await user.clear(input)
    await user.type(input, "999")
    await user.keyboard("{Escape}")

    expect(onPatch).not.toHaveBeenCalled()
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument()
  })

  it("does not update the displayed cost after Escape", async () => {
    renderRow()
    const user = userEvent.setup()
    await user.click(screen.getByText("$100"))

    const input = screen.getByRole("spinbutton")
    await user.clear(input)
    await user.type(input, "999")
    await user.keyboard("{Escape}")

    // Cost button is back and still shows the original value
    expect(screen.getByText("$100")).toBeInTheDocument()
  })
})

// ── Enter with negative value ─────────────────────────────────────────────────

describe("Inline cost edit: Enter key with negative value", () => {
  it("does NOT call onPatch when Enter is pressed with a negative value", async () => {
    const onPatch = renderRow()
    const user = userEvent.setup()
    await user.click(screen.getByText("$100"))

    const input = screen.getByRole("spinbutton")
    await user.clear(input)
    await user.type(input, "-1")
    await user.keyboard("{Enter}")

    expect(onPatch).not.toHaveBeenCalled()
  })
})
