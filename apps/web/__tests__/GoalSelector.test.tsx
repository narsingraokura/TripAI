import { render, screen, fireEvent } from "@testing-library/react"
import GoalSelector from "@/components/itinerary/GoalSelector"
import type { Goal } from "@/types/itinerary"
import { PRESET_GOALS } from "@/types/itinerary"

const PRESET_GOAL: Goal = {
  id: "preset-Cultural experiences",
  label: "Cultural experiences",
  isPreset: true,
}
const CUSTOM_GOAL: Goal = { id: "custom-1", label: "Photography spots", isPreset: false }

beforeEach(() => {
  jest.clearAllMocks()
})

// ── Preset grid ─────────────────────────────────────────────────────────────────

describe("Preset grid", () => {
  it("renders all 8 preset goals", () => {
    render(<GoalSelector selectedGoals={[]} onGoalsChange={jest.fn()} />)
    for (const label of PRESET_GOALS) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument()
    }
  })

  it("clicking an unselected preset calls onGoalsChange with it added", () => {
    const onGoalsChange = jest.fn()
    render(<GoalSelector selectedGoals={[]} onGoalsChange={onGoalsChange} />)
    fireEvent.click(screen.getByRole("button", { name: "Cultural experiences" }))
    expect(onGoalsChange).toHaveBeenCalledWith([
      expect.objectContaining({ label: "Cultural experiences", isPreset: true }),
    ])
  })

  it("clicking a selected preset calls onGoalsChange with it removed", () => {
    const onGoalsChange = jest.fn()
    render(
      <GoalSelector selectedGoals={[PRESET_GOAL]} onGoalsChange={onGoalsChange} />,
    )
    fireEvent.click(screen.getByRole("button", { name: "Cultural experiences" }))
    expect(onGoalsChange).toHaveBeenCalledWith([])
  })

  it("selected preset chip is visually selected", () => {
    render(<GoalSelector selectedGoals={[PRESET_GOAL]} onGoalsChange={jest.fn()} />)
    const chip = screen.getByRole("button", { name: "Cultural experiences" })
    expect(chip.className).toMatch(/bg-slate-800/)
  })
})

// ── Custom input ────────────────────────────────────────────────────────────────

describe("Custom input", () => {
  it("adds a custom goal when Add is clicked", () => {
    const onGoalsChange = jest.fn()
    render(<GoalSelector selectedGoals={[]} onGoalsChange={onGoalsChange} />)
    fireEvent.change(screen.getByPlaceholderText(/add a custom goal/i), {
      target: { value: "Photography spots" },
    })
    fireEvent.click(screen.getByRole("button", { name: /add goal/i }))
    expect(onGoalsChange).toHaveBeenCalledWith([
      expect.objectContaining({ label: "Photography spots", isPreset: false }),
    ])
  })

  it("adds a custom goal on Enter key", () => {
    const onGoalsChange = jest.fn()
    render(<GoalSelector selectedGoals={[]} onGoalsChange={onGoalsChange} />)
    fireEvent.change(screen.getByPlaceholderText(/add a custom goal/i), {
      target: { value: "Photography spots" },
    })
    fireEvent.keyDown(screen.getByPlaceholderText(/add a custom goal/i), { key: "Enter" })
    expect(onGoalsChange).toHaveBeenCalledTimes(1)
  })

  it("input respects 120-char maxLength attribute", () => {
    render(<GoalSelector selectedGoals={[]} onGoalsChange={jest.fn()} />)
    const input = screen.getByPlaceholderText(/add a custom goal/i)
    expect(input).toHaveAttribute("maxLength", "120")
  })

  it("disables input when 3 custom goals are already selected", () => {
    const customs: Goal[] = [
      { id: "c1", label: "Photography", isPreset: false },
      { id: "c2", label: "Hiking", isPreset: false },
      { id: "c3", label: "Cooking classes", isPreset: false },
    ]
    render(<GoalSelector selectedGoals={customs} onGoalsChange={jest.fn()} />)
    expect(screen.getByPlaceholderText(/add a custom goal/i)).toBeDisabled()
  })

  it("disables Add button when 3 custom goals are already selected", () => {
    const customs: Goal[] = [
      { id: "c1", label: "Photography", isPreset: false },
      { id: "c2", label: "Hiking", isPreset: false },
      { id: "c3", label: "Cooking classes", isPreset: false },
    ]
    render(<GoalSelector selectedGoals={customs} onGoalsChange={jest.fn()} />)
    expect(screen.getByRole("button", { name: /add goal/i })).toBeDisabled()
  })

  it("does not call onGoalsChange when input is empty", () => {
    const onGoalsChange = jest.fn()
    render(<GoalSelector selectedGoals={[]} onGoalsChange={onGoalsChange} />)
    fireEvent.click(screen.getByRole("button", { name: /add goal/i }))
    expect(onGoalsChange).not.toHaveBeenCalled()
  })
})

// ── Your goals section ──────────────────────────────────────────────────────────

describe("Your goals section", () => {
  it("shows validation message when no goals selected", () => {
    render(<GoalSelector selectedGoals={[]} onGoalsChange={jest.fn()} />)
    expect(screen.getByText(/select at least 1 goal/i)).toBeInTheDocument()
  })

  it("does not show validation message when goals are selected", () => {
    render(<GoalSelector selectedGoals={[PRESET_GOAL]} onGoalsChange={jest.fn()} />)
    expect(screen.queryByText(/select at least 1 goal/i)).not.toBeInTheDocument()
  })

  it("shows selected goals with remove buttons", () => {
    render(
      <GoalSelector
        selectedGoals={[PRESET_GOAL, CUSTOM_GOAL]}
        onGoalsChange={jest.fn()}
      />,
    )
    expect(
      screen.getByRole("button", { name: /remove cultural experiences/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /remove photography spots/i }),
    ).toBeInTheDocument()
  })

  it("clicking remove in 'Your goals' calls onGoalsChange without that goal", () => {
    const onGoalsChange = jest.fn()
    render(
      <GoalSelector
        selectedGoals={[PRESET_GOAL, CUSTOM_GOAL]}
        onGoalsChange={onGoalsChange}
      />,
    )
    fireEvent.click(
      screen.getByRole("button", { name: /remove cultural experiences/i }),
    )
    expect(onGoalsChange).toHaveBeenCalledWith([CUSTOM_GOAL])
  })
})
