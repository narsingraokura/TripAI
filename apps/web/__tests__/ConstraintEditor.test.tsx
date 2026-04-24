import { render, screen, fireEvent } from "@testing-library/react"
import ConstraintEditor from "@/components/itinerary/ConstraintEditor"
import type { Constraint, ConstraintType, ConstraintStatus } from "@/types/itinerary"

function makeConstraint(i: number): Constraint {
  return {
    id: `c${i}`,
    type: "budget" as ConstraintType,
    description: `Constraint ${i}`,
    status: "ok" as ConstraintStatus,
  }
}

const EXISTING: Constraint[] = [
  { id: "c1", type: "budget", description: "Max $5000 for hotels", value: "$5000", status: "ok" },
  { id: "c2", type: "pace", description: "No more than 2 busy days in a row", status: "warning" },
]

beforeEach(() => {
  jest.clearAllMocks()
})

// ── Rendering ───────────────────────────────────────────────────────────────────

describe("rendering", () => {
  it("renders existing constraint descriptions", () => {
    render(<ConstraintEditor constraints={EXISTING} onConstraintsChange={jest.fn()} />)
    expect(screen.getByText("Max $5000 for hotels")).toBeInTheDocument()
    expect(screen.getByText("No more than 2 busy days in a row")).toBeInTheDocument()
  })

  it("shows constraint counter", () => {
    const constraints = Array.from({ length: 5 }, (_, i) => makeConstraint(i))
    render(<ConstraintEditor constraints={constraints} onConstraintsChange={jest.fn()} />)
    expect(screen.getByText("5 / 10")).toBeInTheDocument()
  })

  it("shows 0 / 10 with no constraints", () => {
    render(<ConstraintEditor constraints={[]} onConstraintsChange={jest.fn()} />)
    expect(screen.getByText("0 / 10")).toBeInTheDocument()
  })
})

// ── Add form ────────────────────────────────────────────────────────────────────

describe("Add form", () => {
  it("adds a new constraint when form is submitted", () => {
    const onConstraintsChange = jest.fn()
    render(<ConstraintEditor constraints={[]} onConstraintsChange={onConstraintsChange} />)
    fireEvent.change(screen.getByLabelText("Type"), { target: { value: "budget" } })
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Max $3000 for hotels" },
    })
    fireEvent.click(screen.getByRole("button", { name: /add constraint/i }))
    expect(onConstraintsChange).toHaveBeenCalledWith([
      expect.objectContaining({
        type: "budget",
        description: "Max $3000 for hotels",
        status: "ok",
      }),
    ])
  })

  it("does not add when type is empty", () => {
    const onConstraintsChange = jest.fn()
    render(<ConstraintEditor constraints={[]} onConstraintsChange={onConstraintsChange} />)
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Some constraint" },
    })
    fireEvent.click(screen.getByRole("button", { name: /add constraint/i }))
    expect(onConstraintsChange).not.toHaveBeenCalled()
  })

  it("does not add when description is empty", () => {
    const onConstraintsChange = jest.fn()
    render(<ConstraintEditor constraints={[]} onConstraintsChange={onConstraintsChange} />)
    fireEvent.change(screen.getByLabelText("Type"), { target: { value: "budget" } })
    fireEvent.click(screen.getByRole("button", { name: /add constraint/i }))
    expect(onConstraintsChange).not.toHaveBeenCalled()
  })
})

// ── Conditional value input ─────────────────────────────────────────────────────

describe("Conditional value input", () => {
  it("shows value input for budget type", () => {
    render(<ConstraintEditor constraints={[]} onConstraintsChange={jest.fn()} />)
    fireEvent.change(screen.getByLabelText("Type"), { target: { value: "budget" } })
    expect(screen.getByLabelText("Value")).toBeInTheDocument()
  })

  it("shows value input for dates type", () => {
    render(<ConstraintEditor constraints={[]} onConstraintsChange={jest.fn()} />)
    fireEvent.change(screen.getByLabelText("Type"), { target: { value: "dates" } })
    expect(screen.getByLabelText("Value")).toBeInTheDocument()
  })

  it("does not show value input for dietary type", () => {
    render(<ConstraintEditor constraints={[]} onConstraintsChange={jest.fn()} />)
    fireEvent.change(screen.getByLabelText("Type"), { target: { value: "dietary" } })
    expect(screen.queryByLabelText("Value")).not.toBeInTheDocument()
  })

  it("does not show value input for pace type", () => {
    render(<ConstraintEditor constraints={[]} onConstraintsChange={jest.fn()} />)
    fireEvent.change(screen.getByLabelText("Type"), { target: { value: "pace" } })
    expect(screen.queryByLabelText("Value")).not.toBeInTheDocument()
  })

  it("includes value in submitted constraint when provided", () => {
    const onConstraintsChange = jest.fn()
    render(<ConstraintEditor constraints={[]} onConstraintsChange={onConstraintsChange} />)
    fireEvent.change(screen.getByLabelText("Type"), { target: { value: "budget" } })
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Max hotel spend" },
    })
    fireEvent.change(screen.getByLabelText("Value"), { target: { value: "$3000" } })
    fireEvent.click(screen.getByRole("button", { name: /add constraint/i }))
    expect(onConstraintsChange).toHaveBeenCalledWith([
      expect.objectContaining({ value: "$3000" }),
    ])
  })
})

// ── Max 10 cap ──────────────────────────────────────────────────────────────────

describe("Max 10 cap", () => {
  it("disables Add button at 10 constraints", () => {
    const constraints = Array.from({ length: 10 }, (_, i) => makeConstraint(i))
    render(<ConstraintEditor constraints={constraints} onConstraintsChange={jest.fn()} />)
    expect(screen.getByRole("button", { name: /add constraint/i })).toBeDisabled()
  })

  it("shows 10 / 10 counter at max", () => {
    const constraints = Array.from({ length: 10 }, (_, i) => makeConstraint(i))
    render(<ConstraintEditor constraints={constraints} onConstraintsChange={jest.fn()} />)
    expect(screen.getByText("10 / 10")).toBeInTheDocument()
  })
})

// ── Delete ──────────────────────────────────────────────────────────────────────

describe("Delete", () => {
  it("deleting a constraint calls onConstraintsChange without it", () => {
    const onConstraintsChange = jest.fn()
    render(
      <ConstraintEditor constraints={EXISTING} onConstraintsChange={onConstraintsChange} />,
    )
    // ConstraintBadge shows trash → confirm → delete
    const trashBtns = screen.getAllByRole("button", { name: /delete constraint/i })
    fireEvent.click(trashBtns[0])
    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }))
    expect(onConstraintsChange).toHaveBeenCalledWith(
      expect.arrayContaining([EXISTING[1]]),
    )
    expect(onConstraintsChange).toHaveBeenCalledWith(
      expect.not.arrayContaining([EXISTING[0]]),
    )
  })
})
