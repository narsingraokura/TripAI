import { render, screen, waitFor } from "@testing-library/react"
import TripTile from "@/components/TripTile"

const MOCK_RESPONSE = {
  bookings: [],
  summary: {
    total_estimated: 15970,
    total_actual: 0,
    locked_in: 4800,
    remaining: 20200,
    booked_count: 4,
    total_count: 14,
  },
}

const DEMO_PROPS = {
  variant: "demo" as const,
  tripId: "trip-123",
  tripName: "Kura Europe 2026",
  family: "Kura Family",
  travelerCount: 4,
  dateRange: "Jun 19 – Jul 5",
  cities: ["London", "Paris", "Interlaken", "Milan"],
  href: "/trip",
}

beforeAll(() => {
  process.env.NEXT_PUBLIC_API_URL = "http://localhost:8000"
})

describe("TripTile — demo variant", () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => MOCK_RESPONSE,
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("renders trip name and date range", async () => {
    render(<TripTile {...DEMO_PROPS} />)
    expect(await screen.findByText("Kura Europe 2026")).toBeInTheDocument()
    expect(screen.getByText(/Jun 19/)).toBeInTheDocument()
  })

  it("renders DEMO badge", () => {
    render(<TripTile {...DEMO_PROPS} />)
    expect(screen.getByText("DEMO")).toBeInTheDocument()
  })

  it("renders family label", () => {
    render(<TripTile {...DEMO_PROPS} />)
    expect(screen.getByText("Kura Family")).toBeInTheDocument()
  })

  it("renders all city names", async () => {
    render(<TripTile {...DEMO_PROPS} />)
    await waitFor(() => {
      for (const city of DEMO_PROPS.cities) {
        expect(screen.getByText(city)).toBeInTheDocument()
      }
    })
  })

  it("renders live stats including traveler count", async () => {
    const { booked_count, total_count, locked_in } = MOCK_RESPONSE.summary
    const expectedUsd = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(locked_in)

    render(<TripTile {...DEMO_PROPS} />)
    await waitFor(() => {
      expect(
        screen.getByText(new RegExp(`${booked_count} \\/ ${total_count}`))
      ).toBeInTheDocument()
      expect(
        screen.getByText(new RegExp(expectedUsd.replace("$", "\\$")))
      ).toBeInTheDocument()
      expect(screen.getByText(/4 travelers/)).toBeInTheDocument()
    })
  })

  it("links to the trip page", async () => {
    render(<TripTile {...DEMO_PROPS} />)
    await waitFor(() => {
      const link = screen.getByRole("link")
      expect(link).toHaveAttribute("href", "/trip")
    })
  })

  it("hides stats on API error without showing error copy", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("Network error"))
    render(<TripTile {...DEMO_PROPS} />)
    expect(screen.getByText("Kura Europe 2026")).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByText(/network error/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/failed/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/travelers/)).not.toBeInTheDocument()
    })
  })
})

describe("TripTile — new variant", () => {
  it("renders Plan a new trip label", () => {
    render(<TripTile variant="new" comingSoon={true} />)
    expect(screen.getByText("Plan a new trip")).toBeInTheDocument()
  })

  it("shows Coming soon badge when comingSoon is true", () => {
    render(<TripTile variant="new" comingSoon={true} />)
    expect(screen.getByText("Coming soon")).toBeInTheDocument()
  })

  it("hides Coming soon badge when comingSoon is false", () => {
    render(<TripTile variant="new" comingSoon={false} />)
    expect(screen.queryByText("Coming soon")).not.toBeInTheDocument()
  })

  it("is not clickable", () => {
    render(<TripTile variant="new" comingSoon={true} />)
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
  })

  it("has dashed border styling", () => {
    const { container } = render(<TripTile variant="new" comingSoon={true} />)
    const tile = container.firstChild as HTMLElement
    expect(tile.className).toMatch(/dashed/)
  })
})
