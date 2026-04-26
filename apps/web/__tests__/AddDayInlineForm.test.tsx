import { render, screen, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import AddDayInlineForm from "@/components/itinerary/AddDayInlineForm"

const noop = () => undefined

const defaultProps = {
  defaultDate: "2026-06-21",
  submitting: false,
  error: null,
  onAdd: jest.fn(),
  onCancel: jest.fn(),
}

beforeEach(() => {
  jest.clearAllMocks()
})

it("renders city input, day_type dropdown, and date field", () => {
  render(<AddDayInlineForm {...defaultProps} />)
  expect(screen.getByRole("textbox", { name: /city/i })).toBeInTheDocument()
  expect(screen.getByRole("combobox", { name: /day type/i })).toBeInTheDocument()
  expect(screen.getByText(/jun 21/i)).toBeInTheDocument()
})

it("pre-populates the date field from defaultDate", () => {
  render(<AddDayInlineForm {...defaultProps} defaultDate="2026-07-04" />)
  // The date is shown as a formatted string somewhere in the form
  expect(screen.getByDisplayValue("2026-07-04")).toBeInTheDocument()
})

it("calls onAdd with city and dayType when submitted", async () => {
  const onAdd = jest.fn()
  render(<AddDayInlineForm {...defaultProps} onAdd={onAdd} />)

  await userEvent.type(screen.getByRole("textbox", { name: /city/i }), "Rome")
  await userEvent.selectOptions(screen.getByRole("combobox", { name: /day type/i }), "rest")
  fireEvent.click(screen.getByRole("button", { name: /add day/i }))

  expect(onAdd).toHaveBeenCalledWith(
    expect.stringContaining("2026-06-21"),
    "Rome",
    "rest",
  )
})

it("does not call onAdd when city is empty", () => {
  const onAdd = jest.fn()
  render(<AddDayInlineForm {...defaultProps} onAdd={onAdd} />)
  fireEvent.click(screen.getByRole("button", { name: /add day/i }))
  expect(onAdd).not.toHaveBeenCalled()
})

it("shows error message when error prop is set", () => {
  render(<AddDayInlineForm {...defaultProps} error="Failed to add day." />)
  expect(screen.getByText("Failed to add day.")).toBeInTheDocument()
})

it("does not show error text when error prop is null", () => {
  render(<AddDayInlineForm {...defaultProps} error={null} />)
  expect(screen.queryByText(/failed/i)).not.toBeInTheDocument()
})

it("disables submit while submitting", () => {
  render(<AddDayInlineForm {...defaultProps} submitting />)
  expect(screen.getByRole("button", { name: /adding/i })).toBeDisabled()
})

it("calls onCancel when Cancel is clicked", () => {
  const onCancel = jest.fn()
  render(<AddDayInlineForm {...defaultProps} onCancel={onCancel} />)
  fireEvent.click(screen.getByRole("button", { name: /cancel/i }))
  expect(onCancel).toHaveBeenCalledTimes(1)
})
