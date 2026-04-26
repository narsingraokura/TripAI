import {
  patchBookingStatus,
  patchBooking,
  createBooking,
  deleteBooking,
  patchItineraryDay,
  createItineraryDay,
  deleteItineraryDay,
  fetchSuggestions,
  streamChat,
  fetchItineraryFull,
  putTripGoals,
  postTripConstraint,
  deleteTripConstraint,
} from "@/lib/api"

// ── Environment ────────────────────────────────────────────────────────────────

const API_BASE = "http://localhost:8000"
const TRIP_ID = "trip-test-123"
const ADMIN_KEY = "test-admin-key"

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_URL = API_BASE
  process.env.NEXT_PUBLIC_TRIP_ID = TRIP_ID
  process.env.NEXT_PUBLIC_ADMIN_API_KEY = ADMIN_KEY
  global.fetch = jest.fn()
})

afterEach(() => {
  delete process.env.NEXT_PUBLIC_API_URL
  delete process.env.NEXT_PUBLIC_TRIP_ID
  delete process.env.NEXT_PUBLIC_ADMIN_API_KEY
  jest.resetAllMocks()
})

function mockFetchOk(body: unknown) {
  ;(global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  })
}

function capturedHeaders(): Record<string, string> {
  const call = (global.fetch as jest.Mock).mock.calls[0]
  return (call[1]?.headers ?? {}) as Record<string, string>
}

// ── X-API-Key header — guarded write functions ─────────────────────────────────

describe("X-API-Key header on guarded write functions", () => {
  it("patchBookingStatus sends X-API-Key", async () => {
    mockFetchOk({ id: "b1", status: "booked" })
    await patchBookingStatus("b1", "booked")
    expect(capturedHeaders()["X-API-Key"]).toBe(ADMIN_KEY)
  })

  it("patchItineraryDay sends X-API-Key", async () => {
    mockFetchOk({ id: "d1", date: "2026-06-20", title: "London" })
    await patchItineraryDay("2026-06-20", { title: "London" })
    expect(capturedHeaders()["X-API-Key"]).toBe(ADMIN_KEY)
  })

  it("createItineraryDay sends X-API-Key", async () => {
    mockFetchOk({ id: "d2", date: "2026-07-06", title: "New Day" })
    await createItineraryDay({
      date: "2026-07-06",
      city: "Rome",
      country: "Italy",
      title: "New Day",
    })
    expect(capturedHeaders()["X-API-Key"]).toBe(ADMIN_KEY)
  })

  it("deleteItineraryDay sends X-API-Key", async () => {
    mockFetchOk(null)
    await deleteItineraryDay("2026-07-06")
    expect(capturedHeaders()["X-API-Key"]).toBe(ADMIN_KEY)
  })

  it("fetchSuggestions sends X-API-Key", async () => {
    mockFetchOk({ date: "2026-06-20", city: "London", suggestions: [] })
    await fetchSuggestions("2026-06-20")
    expect(capturedHeaders()["X-API-Key"]).toBe(ADMIN_KEY)
  })

  it("patchBooking sends X-API-Key", async () => {
    mockFetchOk({ id: "b1", status: "booked" })
    await patchBooking("b1", { status: "booked" })
    expect(capturedHeaders()["X-API-Key"]).toBe(ADMIN_KEY)
  })

  it("createBooking sends X-API-Key", async () => {
    mockFetchOk({ id: "b-new", title: "Test Hotel" })
    await createBooking({ title: "Test Hotel", category: "hotels", urgency: "now", estimated_cost: 500 })
    expect(capturedHeaders()["X-API-Key"]).toBe(ADMIN_KEY)
  })

  it("deleteBooking sends X-API-Key", async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true, status: 204 })
    await deleteBooking("b1")
    expect(capturedHeaders()["X-API-Key"]).toBe(ADMIN_KEY)
  })
})

// ── streamChat is intentionally open — no key ──────────────────────────────────

describe("streamChat does not send X-API-Key", () => {
  it("streamChat omits X-API-Key header", async () => {
    // Return ok:false so the generator throws before reaching TextDecoder,
    // which is not available in jsdom. We only care about the headers here.
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 502 })
    try {
      for await (const _ of streamChat("hello", [])) { /* drain */ }
    } catch {
      // expected: generator throws on non-ok response
    }
    expect(capturedHeaders()["X-API-Key"]).toBeUndefined()
  })
})

// ── getAdminApiKey() throws on missing env var ─────────────────────────────────

describe("getAdminApiKey throws when env var is missing", () => {
  it("patchBookingStatus throws if NEXT_PUBLIC_ADMIN_API_KEY is unset", async () => {
    delete process.env.NEXT_PUBLIC_ADMIN_API_KEY
    await expect(patchBookingStatus("b1", "booked")).rejects.toThrow(
      "NEXT_PUBLIC_ADMIN_API_KEY is not set",
    )
    expect(global.fetch).not.toHaveBeenCalled()
  })
})

// ── patchBooking, createBooking, deleteBooking ─────────────────────────────────

describe("patchBooking", () => {
  it("sends PATCH method", async () => {
    mockFetchOk({ id: "b1", status: "booked" })
    await patchBooking("b1", { status: "booked" })
    const opts = (global.fetch as jest.Mock).mock.calls[0][1] as RequestInit
    expect(opts.method).toBe("PATCH")
  })

  it("hits /trips/{tripId}/bookings/{bookingId}", async () => {
    mockFetchOk({ id: "b1", status: "booked" })
    await patchBooking("b1", { status: "booked" })
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string
    expect(url).toBe(`${API_BASE}/trips/${TRIP_ID}/bookings/b1`)
  })

  it("serialises patch body", async () => {
    mockFetchOk({ id: "b1", actual_cost: 350 })
    await patchBooking("b1", { actual_cost: 350 })
    const opts = (global.fetch as jest.Mock).mock.calls[0][1] as RequestInit
    expect(JSON.parse(opts.body as string)).toEqual({ actual_cost: 350 })
  })
})

describe("createBooking", () => {
  it("sends POST method", async () => {
    mockFetchOk({ id: "b-new", title: "Test Hotel" })
    await createBooking({ title: "Test Hotel", category: "hotels", urgency: "now", estimated_cost: 500 })
    const opts = (global.fetch as jest.Mock).mock.calls[0][1] as RequestInit
    expect(opts.method).toBe("POST")
  })

  it("hits /trips/{tripId}/bookings", async () => {
    mockFetchOk({ id: "b-new", title: "Test Hotel" })
    await createBooking({ title: "Test Hotel", category: "hotels", urgency: "now", estimated_cost: 500 })
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string
    expect(url).toBe(`${API_BASE}/trips/${TRIP_ID}/bookings`)
  })
})

describe("deleteBooking", () => {
  it("sends DELETE method", async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true, status: 204 })
    await deleteBooking("b1")
    const opts = (global.fetch as jest.Mock).mock.calls[0][1] as RequestInit
    expect(opts.method).toBe("DELETE")
  })

  it("hits /trips/{tripId}/bookings/{bookingId}", async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true, status: 204 })
    await deleteBooking("b1")
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string
    expect(url).toBe(`${API_BASE}/trips/${TRIP_ID}/bookings/b1`)
  })
})

// ── Phase-2 API functions ──────────────────────────────────────────────────────

describe("fetchItineraryFull", () => {
  it("hits /api/trips/{tripId}/itinerary", async () => {
    mockFetchOk({ days: [], goals: [], constraints: [] })
    await fetchItineraryFull()
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string
    expect(url).toBe(`${API_BASE}/api/trips/${TRIP_ID}/itinerary`)
  })

  it("does not send X-API-Key (read-only endpoint)", async () => {
    mockFetchOk({ days: [], goals: [], constraints: [] })
    await fetchItineraryFull()
    expect(capturedHeaders()["X-API-Key"]).toBeUndefined()
  })
})

describe("putTripGoals", () => {
  it("sends X-API-Key header", async () => {
    mockFetchOk([])
    await putTripGoals([])
    expect(capturedHeaders()["X-API-Key"]).toBe(ADMIN_KEY)
  })

  it("uses PUT method", async () => {
    mockFetchOk([])
    await putTripGoals([])
    const opts = (global.fetch as jest.Mock).mock.calls[0][1] as RequestInit
    expect(opts.method).toBe("PUT")
  })

  it("serialises goals into { goals: [...] } body", async () => {
    mockFetchOk([])
    await putTripGoals([{ goal_type: "preset", label: "Cultural experiences" }])
    const opts = (global.fetch as jest.Mock).mock.calls[0][1] as RequestInit
    expect(JSON.parse(opts.body as string)).toEqual({
      goals: [{ goal_type: "preset", label: "Cultural experiences" }],
    })
  })
})

describe("postTripConstraint", () => {
  it("sends X-API-Key header", async () => {
    mockFetchOk({
      id: "c1",
      trip_id: TRIP_ID,
      constraint_type: "custom",
      description: "test",
      value: null,
      created_at: "",
    })
    await postTripConstraint({ constraint_type: "custom", description: "test" })
    expect(capturedHeaders()["X-API-Key"]).toBe(ADMIN_KEY)
  })

  it("hits /api/trips/{tripId}/constraints", async () => {
    mockFetchOk({
      id: "c1",
      trip_id: TRIP_ID,
      constraint_type: "custom",
      description: "test",
      value: null,
      created_at: "",
    })
    await postTripConstraint({ constraint_type: "custom", description: "test" })
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string
    expect(url).toBe(`${API_BASE}/api/trips/${TRIP_ID}/constraints`)
  })
})

describe("deleteTripConstraint", () => {
  it("sends X-API-Key header", async () => {
    mockFetchOk(null)
    await deleteTripConstraint("con-1")
    expect(capturedHeaders()["X-API-Key"]).toBe(ADMIN_KEY)
  })

  it("hits /api/trips/{tripId}/constraints/{id}", async () => {
    mockFetchOk(null)
    await deleteTripConstraint("con-1")
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string
    expect(url).toBe(`${API_BASE}/api/trips/${TRIP_ID}/constraints/con-1`)
  })

  it("uses DELETE method", async () => {
    mockFetchOk(null)
    await deleteTripConstraint("con-1")
    const opts = (global.fetch as jest.Mock).mock.calls[0][1] as RequestInit
    expect(opts.method).toBe("DELETE")
  })
})
