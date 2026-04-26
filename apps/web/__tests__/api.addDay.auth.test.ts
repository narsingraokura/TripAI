/**
 * Auth header regression tests for addItineraryDay and validateItineraryMutation.
 *
 * Both routes are guarded by X-API-Key. This test uses the real api.ts implementation
 * (not mocked at the module level) to catch future regressions where the header is dropped.
 *
 * Per CLAUDE.md LP-06a/b: when a backend guard is added, a frontend regression test
 * must verify the corresponding fetch call sends the required header.
 */

import { addItineraryDay, validateItineraryMutation } from "@/lib/api"

beforeAll(() => {
  process.env.NEXT_PUBLIC_ADMIN_API_KEY = "test-api-key"
  process.env.NEXT_PUBLIC_TRIP_ID = "test-trip-id"
  process.env.NEXT_PUBLIC_API_URL = "http://localhost:8000"
})

afterAll(() => {
  delete process.env.NEXT_PUBLIC_ADMIN_API_KEY
  delete process.env.NEXT_PUBLIC_TRIP_ID
  delete process.env.NEXT_PUBLIC_API_URL
})

beforeEach(() => {
  // Mock fetch to return 403 so the function throws before trying to parse a body.
  // This lets us assert the request headers without hitting a real server.
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status: 403,
  } as Response)
})

afterEach(() => {
  jest.restoreAllMocks()
})

it("addItineraryDay sends a non-empty X-API-Key header", async () => {
  await expect(
    addItineraryDay({ position: 1, date: "2026-06-19", city: "London", day_type: "exploration" }),
  ).rejects.toThrow()

  expect(global.fetch).toHaveBeenCalledWith(
    expect.stringContaining("/itinerary/days"),
    expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ "X-API-Key": expect.any(String) }),
    }),
  )
  const headers = (global.fetch as jest.Mock).mock.calls[0][1].headers as Record<string, string>
  expect(headers["X-API-Key"]).toBeTruthy()
})

it("validateItineraryMutation sends a non-empty X-API-Key header", async () => {
  await expect(
    validateItineraryMutation({ mutation_type: "add_day", mutation_description: "test" }),
  ).rejects.toThrow()

  expect(global.fetch).toHaveBeenCalledWith(
    expect.stringContaining("/itinerary/validate"),
    expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ "X-API-Key": expect.any(String) }),
    }),
  )
  const headers = (global.fetch as jest.Mock).mock.calls[0][1].headers as Record<string, string>
  expect(headers["X-API-Key"]).toBeTruthy()
})
