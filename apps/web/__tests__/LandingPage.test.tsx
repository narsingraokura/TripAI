import { render, screen } from "@testing-library/react"
import LandingPage from "@/app/page"

describe("Landing page (/)", () => {
  it("renders tagline", () => {
    render(<LandingPage />)
    expect(screen.getByText("Plan smarter. Travel lighter.")).toBeInTheDocument()
  })

  it("renders link to /trip", () => {
    render(<LandingPage />)
    const link = screen.getByRole("link", { name: /view demo trip/i })
    expect(link).toHaveAttribute("href", "/trip")
  })

  it("renders TripAI heading", () => {
    render(<LandingPage />)
    expect(screen.getByRole("heading", { name: "TripAI" })).toBeInTheDocument()
  })
})
