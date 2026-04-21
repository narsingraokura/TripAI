import {
  patchBookingStatus,
  patchItineraryDay,
  createItineraryDay,
  deleteItineraryDay,
  fetchSuggestions,
  streamChat,
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
