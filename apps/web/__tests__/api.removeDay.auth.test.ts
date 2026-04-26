/**
 * Auth header regression tests for removeItineraryDay and resolveItineraryMutation.
 *
 * Both routes are guarded by X-API-Key on the backend. This test uses the real
 * api.ts (not mocked at the module level) to catch future regressions where the
 * header is dropped.
 *
 * Per CLAUDE.md checklist item 9 and LP-06a/b: when a backend guard is added,
 * a frontend regression test must verify the corresponding fetch call sends the
 * required header. These two functions were added in EDIT-03 and were not yet
 * covered by api.test.ts or api.addDay.auth.test.ts.
 */

import { removeItineraryDay, resolveItineraryMutation } from "@/lib/api"

const ADMIN_KEY = "test-api-key-edit03"
const TRIP_ID = "trip-edit03-uuid"
const API_BASE = "http://localhost:8000"

beforeAll(() => {
  process.env.NEXT_PUBLIC_ADMIN_API_KEY = ADMIN_KEY
  process.env.NEXT_PUBLIC_TRIP_ID = TRIP_ID
  process.env.NEXT_PUBLIC_API_URL = API_BASE
})

afterAll(() => {
  delete process.env.NEXT_PUBLIC_ADMIN_API_KEY
  delete process.env.NEXT_PUBLIC_TRIP_ID
  delete process.env.NEXT_PUBLIC_API_URL
})

beforeEach(() => {
  // Return ok:false so the function throws before parsing a body.
  // This lets us assert the request headers without a real server.
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status: 403,
  } as Response)
})

afterEach(() => {
  jest.restoreAllMocks()
})

it("removeItineraryDay sends a non-empty X-API-Key header", async () => {
  await expect(removeItineraryDay("some-day-id")).rejects.toThrow()

  expect(global.fetch).toHaveBeenCalledWith(
    expect.stringContaining("/itinerary/days/some-day-id"),
    expect.objectContaining({
      method: "DELETE",
      headers: expect.objectContaining({ "X-API-Key": expect.any(String) }),
    }),
  )
  const headers = (global.fetch as jest.Mock).mock.calls[0][1].headers as Record<string, string>
  expect(headers["X-API-Key"]).toBe(ADMIN_KEY)
})

it("resolveItineraryMutation sends a non-empty X-API-Key header", async () => {
  await expect(
    resolveItineraryMutation({
      suggestion_id: "s-1",
      suggestion_payload: { action: "move_activity", activity_id: "a-1", to_day_id: "d-2" },
    }),
  ).rejects.toThrow()

  expect(global.fetch).toHaveBeenCalledWith(
    expect.stringContaining("/itinerary/resolve"),
    expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ "X-API-Key": expect.any(String) }),
    }),
  )
  const headers = (global.fetch as jest.Mock).mock.calls[0][1].headers as Record<string, string>
  expect(headers["X-API-Key"]).toBe(ADMIN_KEY)
})

it("removeItineraryDay uses DELETE method and correct URL", async () => {
  const dayId = "day-uuid-test-01"
  await expect(removeItineraryDay(dayId)).rejects.toThrow()
  const [url, opts] = (global.fetch as jest.Mock).mock.calls[0]
  expect(url).toBe(`${API_BASE}/api/trips/${TRIP_ID}/itinerary/days/${dayId}`)
  expect((opts as RequestInit).method).toBe("DELETE")
})

it("resolveItineraryMutation uses POST method and correct URL", async () => {
  await expect(
    resolveItineraryMutation({
      suggestion_id: "s-2",
      suggestion_payload: { action: "move_activity", activity_id: "a-2", to_day_id: "d-3" },
    }),
  ).rejects.toThrow()
  const [url, opts] = (global.fetch as jest.Mock).mock.calls[0]
  expect(url).toBe(`${API_BASE}/api/trips/${TRIP_ID}/itinerary/resolve`)
  expect((opts as RequestInit).method).toBe("POST")
})
