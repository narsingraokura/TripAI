import { render, screen, fireEvent, act } from "@testing-library/react"
import GoalSuggestionCard from "@/components/itinerary/GoalSuggestionCard"
import type { Resolution } from "@/types/itinerary"

const RESOLUTIONS: Resolution[] = [
  { label: "Swap Paris hotel", description: "Switch to a more affordable option" },
  { label: "Remove Louvre", description: "Save €30 per person" },
]

afterEach(() => {
  jest.useRealTimers()
})

// ── ok variant ──────────────────────────────────────────────────────────────────

describe("ok variant", () => {
  it("renders the message", () => {
    render(<GoalSuggestionCard status="ok" message="Budget on track" />)
    expect(screen.getByText("Budget on track")).toBeInTheDocument()
  })

  it("auto-dismisses after 3 seconds (card is absent)", () => {
    jest.useFakeTimers()
    render(<GoalSuggestionCard status="ok" message="Budget on track" />)
    expect(screen.getByText("Budget on track")).toBeInTheDocument()
    act(() => {
      jest.advanceTimersByTime(3000)
    })
    expect(screen.queryByText("Budget on track")).not.toBeInTheDocument()
  })

  it("does not dismiss before 3 seconds", () => {
    jest.useFakeTimers()
    render(<GoalSuggestionCard status="ok" message="Budget on track" />)
    act(() => {
      jest.advanceTimersByTime(2999)
    })
    expect(screen.getByText("Budget on track")).toBeInTheDocument()
  })

  it("calls onDismiss after 3 seconds", () => {
    jest.useFakeTimers()
    const onDismiss = jest.fn()
    render(<GoalSuggestionCard status="ok" message="Budget on track" onDismiss={onDismiss} />)
    act(() => {
      jest.advanceTimersByTime(3000)
    })
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})

// ── warning variant ─────────────────────────────────────────────────────────────

describe("warning variant", () => {
  it("renders the message", () => {
    render(<GoalSuggestionCard status="warning" message="Over budget by 10%" />)
    expect(screen.getByText("Over budget by 10%")).toBeInTheDocument()
  })

  it("remains visible after 5 seconds (no auto-dismiss)", () => {
    jest.useFakeTimers()
    render(<GoalSuggestionCard status="warning" message="Over budget by 10%" />)
    act(() => {
      jest.advanceTimersByTime(5000)
    })
    expect(screen.getByText("Over budget by 10%")).toBeInTheDocument()
  })
})

// ── violation variant ───────────────────────────────────────────────────────────

describe("violation variant", () => {
  it("renders the message", () => {
    render(
      <GoalSuggestionCard
        status="violation"
        message="$500 over budget"
        resolutions={RESOLUTIONS}
      />,
    )
    expect(screen.getByText("$500 over budget")).toBeInTheDocument()
  })

  it("shows all resolution cards", () => {
    render(
      <GoalSuggestionCard
        status="violation"
        message="$500 over budget"
        resolutions={RESOLUTIONS}
      />,
    )
    expect(screen.getByText("Swap Paris hotel")).toBeInTheDocument()
    expect(screen.getByText("Remove Louvre")).toBeInTheDocument()
  })

  it("shows resolution descriptions", () => {
    render(
      <GoalSuggestionCard
        status="violation"
        message="$500 over budget"
        resolutions={RESOLUTIONS}
      />,
    )
    expect(screen.getByText("Switch to a more affordable option")).toBeInTheDocument()
  })

  it("shows Apply buttons for each resolution", () => {
    render(
      <GoalSuggestionCard
        status="violation"
        message="$500 over budget"
        resolutions={RESOLUTIONS}
      />,
    )
    expect(screen.getAllByRole("button", { name: /apply/i })).toHaveLength(2)
  })

  it("clicking Apply calls onApply with the correct resolution", () => {
    const onApply = jest.fn()
    render(
      <GoalSuggestionCard
        status="violation"
        message="$500 over budget"
        resolutions={RESOLUTIONS}
        onApply={onApply}
      />,
    )
    fireEvent.click(screen.getAllByRole("button", { name: /apply/i })[0])
    expect(onApply).toHaveBeenCalledWith(RESOLUTIONS[0])
  })

  it("renders without resolutions array (no resolution section)", () => {
    render(<GoalSuggestionCard status="violation" message="$500 over budget" />)
    expect(screen.queryByRole("button", { name: /apply/i })).not.toBeInTheDocument()
  })
})

// ── field prop ──────────────────────────────────────────────────────────────────

describe("field prop", () => {
  it("renders the field label when provided", () => {
    render(<GoalSuggestionCard status="warning" message="Check dates" field="Jun 26" />)
    expect(screen.getByText("Jun 26")).toBeInTheDocument()
  })
})
