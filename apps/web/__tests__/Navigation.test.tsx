import { render, screen } from "@testing-library/react"
import Navigation from "@/components/Navigation"

const mockUsePathname = jest.fn()

jest.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}))

describe("Navigation — ← All trips breadcrumb", () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue("/trip")
  })

  it("renders the breadcrumb", () => {
    render(<Navigation />)
    expect(screen.getByText("← All trips")).toBeInTheDocument()
  })

  it("breadcrumb links to /", () => {
    render(<Navigation />)
    const link = screen.getByRole("link", { name: "← All trips" })
    expect(link).toHaveAttribute("href", "/")
  })

  it("breadcrumb is inside the desktop-only nav", () => {
    const { container } = render(<Navigation />)
    const desktopNav = container.querySelector("nav.hidden.md\\:flex")
    expect(desktopNav).not.toBeNull()
    expect(desktopNav).toHaveTextContent("← All trips")
  })
})
