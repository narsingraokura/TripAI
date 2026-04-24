import { render, screen, fireEvent } from "@testing-library/react"
import GoalChip from "@/components/itinerary/GoalChip"

beforeEach(() => {
  jest.clearAllMocks()
})

describe("rendering", () => {
  it("renders the label", () => {
    render(<GoalChip label="Cultural experiences" />)
    expect(screen.getByText("Cultural experiences")).toBeInTheDocument()
  })

  it("selected variant applies filled styling", () => {
    render(<GoalChip label="Cultural experiences" selected />)
    const el = screen.getByText("Cultural experiences").closest("span")
    expect(el?.className).toMatch(/bg-slate-800/)
  })

  it("unselected variant does not apply filled styling", () => {
    render(<GoalChip label="Cultural experiences" />)
    const el = screen.getByText("Cultural experiences").closest("span")
    expect(el?.className).not.toMatch(/bg-slate-800/)
  })

  it("isCustom adds dashed border when unselected", () => {
    render(<GoalChip label="Photography" isCustom />)
    const el = screen.getByText("Photography").closest("span")
    expect(el?.className).toMatch(/border-dashed/)
  })

  it("dashed border is suppressed when isCustom and selected", () => {
    render(<GoalChip label="Photography" isCustom selected />)
    const el = screen.getByText("Photography").closest("span")
    expect(el?.className).not.toMatch(/border-dashed/)
  })
})

describe("remove button", () => {
  it("shows × button when onRemove is provided", () => {
    render(<GoalChip label="Cultural experiences" onRemove={jest.fn()} />)
    expect(screen.getByRole("button", { name: /remove cultural experiences/i })).toBeInTheDocument()
  })

  it("does not show × button when onRemove is not provided", () => {
    render(<GoalChip label="Cultural experiences" />)
    expect(screen.queryByRole("button", { name: /remove/i })).not.toBeInTheDocument()
  })

  it("clicking × calls onRemove", () => {
    const onRemove = jest.fn()
    render(<GoalChip label="Cultural experiences" onRemove={onRemove} />)
    fireEvent.click(screen.getByRole("button", { name: /remove cultural experiences/i }))
    expect(onRemove).toHaveBeenCalledTimes(1)
  })

  it("clicking × does not call onClick", () => {
    const onClick = jest.fn()
    const onRemove = jest.fn()
    render(<GoalChip label="Cultural experiences" onClick={onClick} onRemove={onRemove} />)
    fireEvent.click(screen.getByRole("button", { name: /remove cultural experiences/i }))
    expect(onClick).not.toHaveBeenCalled()
  })
})

describe("onClick interaction", () => {
  it("chip has role button when onClick is provided", () => {
    render(<GoalChip label="Cultural experiences" onClick={jest.fn()} />)
    expect(screen.getByRole("button", { name: "Cultural experiences" })).toBeInTheDocument()
  })

  it("clicking the chip body calls onClick", () => {
    const onClick = jest.fn()
    render(<GoalChip label="Cultural experiences" onClick={onClick} />)
    fireEvent.click(screen.getByRole("button", { name: "Cultural experiences" }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it("chip has no button role when onClick is not provided", () => {
    render(<GoalChip label="Cultural experiences" />)
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })
})
