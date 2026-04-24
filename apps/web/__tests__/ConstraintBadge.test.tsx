import { render, screen, fireEvent } from "@testing-library/react"
import ConstraintBadge from "@/components/itinerary/ConstraintBadge"
import type { Constraint } from "@/types/itinerary"

const BASE: Constraint = {
  id: "c1",
  type: "budget",
  description: "Max $3000 for hotels",
  status: "ok",
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe("rendering", () => {
  it("renders description", () => {
    render(<ConstraintBadge constraint={BASE} onDelete={jest.fn()} />)
    expect(screen.getByText("Max $3000 for hotels")).toBeInTheDocument()
  })

  it("renders optional value when provided", () => {
    const c: Constraint = { ...BASE, value: "$3000" }
    render(<ConstraintBadge constraint={c} onDelete={jest.fn()} />)
    expect(screen.getByText("$3000")).toBeInTheDocument()
  })

  it("does not render value element when value is absent", () => {
    render(<ConstraintBadge constraint={BASE} onDelete={jest.fn()} />)
    // description is present but no extra value paragraph
    expect(screen.getAllByText(/.+/).length).toBeGreaterThan(0)
    // more importantly, no "$3000" leaks in
    expect(screen.queryByText("$3000")).not.toBeInTheDocument()
  })

  it("applies green left border for ok status", () => {
    render(<ConstraintBadge constraint={BASE} onDelete={jest.fn()} />)
    const card = screen.getByText("Max $3000 for hotels").closest("div[class*='border-l']")
    expect(card?.className).toMatch(/border-l-green/)
  })

  it("applies amber left border for warning status", () => {
    const c: Constraint = { ...BASE, status: "warning" }
    render(<ConstraintBadge constraint={c} onDelete={jest.fn()} />)
    const card = screen.getByText("Max $3000 for hotels").closest("div[class*='border-l']")
    expect(card?.className).toMatch(/border-l-amber/)
  })

  it("applies red left border for violation status", () => {
    const c: Constraint = { ...BASE, status: "violation" }
    render(<ConstraintBadge constraint={c} onDelete={jest.fn()} />)
    const card = screen.getByText("Max $3000 for hotels").closest("div[class*='border-l']")
    expect(card?.className).toMatch(/border-l-red/)
  })
})

describe("delete confirmation", () => {
  it("shows trash icon button initially", () => {
    render(<ConstraintBadge constraint={BASE} onDelete={jest.fn()} />)
    expect(screen.getByRole("button", { name: /delete constraint/i })).toBeInTheDocument()
  })

  it("clicking trash shows inline confirmation", () => {
    render(<ConstraintBadge constraint={BASE} onDelete={jest.fn()} />)
    fireEvent.click(screen.getByRole("button", { name: /delete constraint/i }))
    expect(screen.getByRole("button", { name: /^delete$/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument()
  })

  it("clicking Cancel hides confirmation without calling onDelete", () => {
    const onDelete = jest.fn()
    render(<ConstraintBadge constraint={BASE} onDelete={onDelete} />)
    fireEvent.click(screen.getByRole("button", { name: /delete constraint/i }))
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }))
    expect(onDelete).not.toHaveBeenCalled()
    expect(screen.queryByRole("button", { name: /^delete$/i })).not.toBeInTheDocument()
  })

  it("clicking Delete confirm calls onDelete with constraint id", () => {
    const onDelete = jest.fn()
    render(<ConstraintBadge constraint={BASE} onDelete={onDelete} />)
    fireEvent.click(screen.getByRole("button", { name: /delete constraint/i }))
    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }))
    expect(onDelete).toHaveBeenCalledWith("c1")
  })
})
