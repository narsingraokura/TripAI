import { render, screen, act } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import UndoToast from "@/components/UndoToast"

// Use setup({ delay: null }) throughout — fake timers break userEvent's internal
// scheduling, so we disable its delays to keep clicks synchronous.
const user = userEvent.setup({ delay: null })

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

it("renders the message and Undo button", () => {
  render(
    <UndoToast message="Day removed." onUndo={jest.fn()} onExpire={jest.fn()} />,
  )
  expect(screen.getByText("Day removed.")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: /undo/i })).toBeInTheDocument()
})

it("calls onUndo when Undo button is clicked", async () => {
  const onUndo = jest.fn()
  render(
    <UndoToast message="Day removed." onUndo={onUndo} onExpire={jest.fn()} />,
  )
  await user.click(screen.getByRole("button", { name: /undo/i }))
  expect(onUndo).toHaveBeenCalledTimes(1)
})

it("calls onExpire and self-dismisses after durationMs elapses", () => {
  const onExpire = jest.fn()
  render(
    <UndoToast
      message="Day removed."
      onUndo={jest.fn()}
      onExpire={onExpire}
      durationMs={10000}
    />,
  )
  expect(screen.getByText("Day removed.")).toBeInTheDocument()
  act(() => {
    jest.advanceTimersByTime(10000)
  })
  expect(onExpire).toHaveBeenCalledTimes(1)
  expect(screen.queryByText("Day removed.")).not.toBeInTheDocument()
})
