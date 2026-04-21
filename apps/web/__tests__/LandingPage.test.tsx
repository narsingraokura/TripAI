import { render, screen } from "@testing-library/react"
import LandingPage from "@/app/page"

jest.mock("@/components/TripTile", () => ({
  __esModule: true,
  default: ({ variant }: { variant: string }) =>
    variant === "demo"
      ? <div data-testid="trip-tile-demo"><a href="/trip">Explore trip →</a></div>
      : <div data-testid="trip-tile-new"><span>Coming soon</span></div>,
}))

describe("Landing page (/)", () => {
  it("renders TripAI wordmark as plain text, not a link", () => {
    render(<LandingPage />)
    expect(screen.getByText("TripAI")).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: /TripAI/i })).not.toBeInTheDocument()
  })

  it("renders primary tagline as the page heading", () => {
    render(<LandingPage />)
    expect(
      screen.getByRole("heading", { name: "Plan smarter. Travel lighter." })
    ).toBeInTheDocument()
  })

  it("renders secondary tagline mentioning the three pillars", () => {
    render(<LandingPage />)
    expect(
      screen.getByText(/bookings.*budget.*AI|AI.*budget.*bookings/i)
    ).toBeInTheDocument()
  })

  it("renders demo trip tile", () => {
    render(<LandingPage />)
    expect(screen.getByTestId("trip-tile-demo")).toBeInTheDocument()
  })

  it("renders new trip tile", () => {
    render(<LandingPage />)
    expect(screen.getByTestId("trip-tile-new")).toBeInTheDocument()
  })

  it("demo tile links to /trip", () => {
    render(<LandingPage />)
    const link = screen.getByRole("link", { name: /explore trip/i })
    expect(link).toHaveAttribute("href", "/trip")
  })
})
