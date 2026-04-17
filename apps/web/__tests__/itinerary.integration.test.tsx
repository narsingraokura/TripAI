/**
 * @jest-environment node
 *
 * Integration tests — hit the real API (localhost:8000).
 * Run with: npm run test:integration
 * Env vars are loaded from .env.local by jest.integration.setup.js (setupFiles).
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
const TRIP_ID = process.env.NEXT_PUBLIC_TRIP_ID ?? ""

// Skip the entire suite unless INTEGRATION_TESTS=true (set by npm run test:integration).
// This prevents the tests from running during `npm test` where no real API is expected.
const itgDescribe =
  process.env.INTEGRATION_TESTS === "true" ? describe : describe.skip

type ItineraryDay = {
  id: string
  trip_id: string
  date: string
  city: string | null
  country: string | null
  title: string
  plan: string
  intensity: string
  is_special: boolean
  special_label: string | null
}

const REQUIRED_FIELDS = ["date", "city", "title", "plan", "intensity"] as const
const DATE_JUN20 = "2026-06-20"

// ── GET /trips/{trip_id}/itinerary ────────────────────────────────────────────

itgDescribe("GET /trips/{trip_id}/itinerary", () => {
  let days: ItineraryDay[]

  beforeAll(async () => {
    if (!TRIP_ID) throw new Error("NEXT_PUBLIC_TRIP_ID env var is not set")
    const res = await fetch(`${API_URL}/trips/${TRIP_ID}/itinerary`)
    const body = (await res.json()) as { days: ItineraryDay[] }
    days = body.days
  })

  it("returns an array of 16 days", () => {
    expect(Array.isArray(days)).toBe(true)
    expect(days).toHaveLength(16)
  })

  it("each day has required fields: date, city, title, plan, intensity", () => {
    for (const day of days) {
      for (const field of REQUIRED_FIELDS) {
        expect(day).toHaveProperty(field)
      }
    }
  })

  it("days are sorted chronologically by date", () => {
    const dates = days.map((d) => d.date)
    expect(dates).toEqual([...dates].sort())
  })
})

// ── PATCH /trips/{trip_id}/itinerary/2026-06-20 ───────────────────────────────

itgDescribe("PATCH /trips/{trip_id}/itinerary/2026-06-20", () => {
  let originalTitle: string
  const TEST_TITLE = "[integration-test] Arrive LHR"

  beforeAll(async () => {
    if (!TRIP_ID) throw new Error("NEXT_PUBLIC_TRIP_ID env var is not set")
    const res = await fetch(`${API_URL}/trips/${TRIP_ID}/itinerary/${DATE_JUN20}`)
    const day = (await res.json()) as ItineraryDay
    originalTitle = day.title
  })

  afterAll(async () => {
    await fetch(`${API_URL}/trips/${TRIP_ID}/itinerary/${DATE_JUN20}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: originalTitle }),
    })
  })

  it("returns 200 and the updated title", async () => {
    const res = await fetch(
      `${API_URL}/trips/${TRIP_ID}/itinerary/${DATE_JUN20}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: TEST_TITLE }),
      },
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as ItineraryDay
    expect(body.title).toBe(TEST_TITLE)
  })
})
