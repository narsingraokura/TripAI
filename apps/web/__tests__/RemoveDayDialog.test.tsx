import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import RemoveDayDialog from "@/components/itinerary/RemoveDayDialog"
import type { Day } from "@/types/itinerary"

const PARIS_DAY: Day = {
  id: "day-paris",
  date: "2026-06-24",
  city: "Paris",
  country: "France",
  dayType: "sightseeing",
  activities: [{ id: "a-1", name: "Eiffel Tower visit", category: "sightseeing", cost: 25, durationMinutes: 120 }],
}

it("renders the confirmation message for the city", () => {
  render(
    <RemoveDayDialog
      day={PARIS_DAY}
      mustVisitActivity={null}
      onConfirm={jest.fn()}
      onCancel={jest.fn()}
    />,
  )
  expect(screen.getByText(/paris/i)).toBeInTheDocument()
  expect(screen.getByRole("button", { name: /remove/i })).toBeInTheDocument()
  expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument()
})

it("shows must_visit warning when an activity is provided", () => {
  render(
    <RemoveDayDialog
      day={PARIS_DAY}
      mustVisitActivity="Eiffel Tower visit"
      onConfirm={jest.fn()}
      onCancel={jest.fn()}
    />,
  )
  expect(screen.getByText(/eiffel tower visit/i)).toBeInTheDocument()
  expect(screen.getByText(/non-negotiable/i)).toBeInTheDocument()
})

it("does not show warning when mustVisitActivity is null", () => {
  render(
    <RemoveDayDialog
      day={PARIS_DAY}
      mustVisitActivity={null}
      onConfirm={jest.fn()}
      onCancel={jest.fn()}
    />,
  )
  expect(screen.queryByText(/non-negotiable/i)).not.toBeInTheDocument()
})

it("calls onConfirm when Remove button is clicked", async () => {
  const onConfirm = jest.fn()
  render(
    <RemoveDayDialog
      day={PARIS_DAY}
      mustVisitActivity={null}
      onConfirm={onConfirm}
      onCancel={jest.fn()}
    />,
  )
  await userEvent.click(screen.getByRole("button", { name: /remove/i }))
  expect(onConfirm).toHaveBeenCalledTimes(1)
})

it("calls onCancel when Cancel button is clicked", async () => {
  const onCancel = jest.fn()
  render(
    <RemoveDayDialog
      day={PARIS_DAY}
      mustVisitActivity={null}
      onConfirm={jest.fn()}
      onCancel={onCancel}
    />,
  )
  await userEvent.click(screen.getByRole("button", { name: /cancel/i }))
  expect(onCancel).toHaveBeenCalledTimes(1)
})
