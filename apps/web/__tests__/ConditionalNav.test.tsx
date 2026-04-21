import { render, screen } from "@testing-library/react"
import ConditionalNav from "@/components/ConditionalNav"

const mockUsePathname = jest.fn()

jest.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}))

jest.mock("@/components/Navigation", () => ({
  __esModule: true,
  default: () => <nav data-testid="navigation">Nav</nav>,
}))

describe("ConditionalNav", () => {
  it("hides Navigation on /", () => {
    mockUsePathname.mockReturnValue("/")
    render(<ConditionalNav />)
    expect(screen.queryByTestId("navigation")).not.toBeInTheDocument()
  })

  it("renders Navigation on /trip", () => {
    mockUsePathname.mockReturnValue("/trip")
    render(<ConditionalNav />)
    expect(screen.getByTestId("navigation")).toBeInTheDocument()
  })

  it("renders Navigation on /chat", () => {
    mockUsePathname.mockReturnValue("/chat")
    render(<ConditionalNav />)
    expect(screen.getByTestId("navigation")).toBeInTheDocument()
  })

  it("renders Navigation on /itinerary", () => {
    mockUsePathname.mockReturnValue("/itinerary")
    render(<ConditionalNav />)
    expect(screen.getByTestId("navigation")).toBeInTheDocument()
  })
})
