/**
 * Adversarial tests for goalError state introduced in fix 7dd5d40 — EDIT-01
 * Probes: exact error text, error lifecycle (clear on success), branch coverage,
 * and edge cases the developer may not have considered.
 * Written by Tester. DO NOT edit source code; only report bugs.
 *
 * NOTE: uses jest.resetAllMocks() (not clearAllMocks) to flush unconsumed
 * mockOnce queues between tests, preventing cross-test contamination.
 */

import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import ItineraryPageClient from "@/components/itinerary/ItineraryPageClient"
import type { ApiGoal, ApiItinerary } from "@/lib/api"
import {
  fetchItineraryFull,
  putTripGoals,
} from "@/lib/api"

// ── Mocks ──────────────────────────────────────────────────────────────────────

jest.mock("@/lib/api", () => ({
  fetchItineraryFull: jest.fn(),
  putTripGoals: jest.fn(),
  postTripConstraint: jest.fn(),
  deleteTripConstraint: jest.fn(),
}))

const mockFetchItineraryFull = fetchItineraryFull as jest.MockedFunction<
  typeof fetchItineraryFull
>
const mockPutTripGoals = putTripGoals as jest.MockedFunction<typeof putTripGoals>

// ── Fixtures ───────────────────────────────────────────────────────────────────

const CULTURAL_GOAL: ApiGoal = {
  id: "goal-1",
  trip_id: "trip-1",
  goal_type: "preset" as const,
  label: "Cultural experiences",
  created_at: "2026-01-01T00:00:00Z",
}

const ADVENTURE_GOAL: ApiGoal = {
  id: "goal-2",
  trip_id: "trip-1",
  goal_type: "preset" as const,
  label: "Outdoor adventures",
  created_at: "2026-01-01T00:00:00Z",
}

const DAY = {
  id: "d1",
  trip_id: "trip-1",
  position: 1,
  date: "2026-06-20",
  city: "London",
  day_type: "exploration" as const,
  notes: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  activities: [],
}

const NO_GOALS: ApiItinerary = { days: [DAY], goals: [], constraints: [] }

const WITH_ONE_GOAL: ApiItinerary = {
  days: [DAY],
  goals: [CULTURAL_GOAL],
  constraints: [],
}

const WITH_TWO_GOALS: ApiItinerary = {
  days: [DAY],
  goals: [CULTURAL_GOAL, ADVENTURE_GOAL],
  constraints: [],
}

// resetAllMocks flushes unconsumed mockOnce queues, preventing cross-test
// contamination that clearAllMocks leaves behind.
beforeEach(() => {
  jest.resetAllMocks()
})

// ── Error text — exact string regression ───────────────────────────────────────

describe("goalError — exact message text", () => {
  it("shows the exact error string when save fails", async () => {
    mockFetchItineraryFull.mockResolvedValue(NO_GOALS)
    mockPutTripGoals.mockRejectedValue(new Error("500"))

    render(<ItineraryPageClient />)
    await screen.findByText(/choose from presets/i)

    fireEvent.click(screen.getByRole("button", { name: "Cultural experiences" }))
    fireEvent.click(screen.getByRole("button", { name: /save goals/i }))

    expect(
      await screen.findByText("Failed to save goals — please try again"),
    ).toBeInTheDocument()
  })

  it("shows the exact error string when remove fails", async () => {
    mockFetchItineraryFull.mockResolvedValue(WITH_ONE_GOAL)
    mockPutTripGoals.mockRejectedValue(new Error("500"))

    render(<ItineraryPageClient />)
    await screen.findByText("Cultural experiences")

    fireEvent.click(
      screen.getByRole("button", { name: /remove cultural experiences/i }),
    )

    expect(
      await screen.findByText("Failed to save goals — please try again"),
    ).toBeInTheDocument()
  })
})

// ── Error lifecycle — cleared on success ───────────────────────────────────────
//
// After a failed save/remove, draftGoals is NOT cleared (the user's selection is
// preserved). To retry, the user clicks "Save goals" directly — no need to
// re-select, since the preset is already in draftGoals. Re-clicking the preset
// would DESELECT it (toggle behaviour).

describe("goalError — cleared on next success", () => {
  it("error message disappears after a subsequent successful save", async () => {
    mockFetchItineraryFull.mockResolvedValue(NO_GOALS)
    // First save attempt: reject. Second: resolve.
    mockPutTripGoals
      .mockRejectedValueOnce(new Error("500"))
      .mockResolvedValue([CULTURAL_GOAL])

    render(<ItineraryPageClient />)
    await screen.findByText(/choose from presets/i)

    // Select a goal and attempt save (fails)
    fireEvent.click(screen.getByRole("button", { name: "Cultural experiences" }))
    fireEvent.click(screen.getByRole("button", { name: /save goals/i }))

    // Error appears; GoalSelector is restored; draftGoals still has the selection
    await screen.findByText(/failed to save goals/i)

    // Retry — do NOT re-click the preset (it is still selected in draftGoals);
    // clicking it again would deselect it (toggle) leaving draftGoals empty.
    fireEvent.click(screen.getByRole("button", { name: /save goals/i }))

    // Error must vanish after success
    await waitFor(() => {
      expect(
        screen.queryByText(/failed to save goals/i),
      ).not.toBeInTheDocument()
    })
  })

  it("error message disappears after a subsequent successful remove", async () => {
    mockFetchItineraryFull.mockResolvedValue(WITH_TWO_GOALS)
    // First remove: reject. Second: resolve (keeping only Adventure).
    mockPutTripGoals
      .mockRejectedValueOnce(new Error("500"))
      .mockResolvedValue([ADVENTURE_GOAL])

    render(<ItineraryPageClient />)
    await screen.findByText("Cultural experiences")

    // First remove of Cultural fails — both goals restored by rollback
    fireEvent.click(
      screen.getByRole("button", { name: /remove cultural experiences/i }),
    )
    await screen.findByText(/failed to save goals/i)
    // Rollback restores the chip
    await screen.findByText("Cultural experiences")

    // Retry remove — succeeds this time
    fireEvent.click(
      screen.getByRole("button", { name: /remove cultural experiences/i }),
    )
    await waitFor(() => {
      expect(
        screen.queryByText(/failed to save goals/i),
      ).not.toBeInTheDocument()
    })
  })
})

// ── Error not shown on happy path ─────────────────────────────────────────────

describe("goalError — absent on happy path", () => {
  it("no error message is shown on a successful initial load", async () => {
    mockFetchItineraryFull.mockResolvedValue(WITH_ONE_GOAL)
    render(<ItineraryPageClient />)
    await screen.findByText("Cultural experiences")
    expect(
      screen.queryByText(/failed to save goals/i),
    ).not.toBeInTheDocument()
  })

  it("no error message after a successful save", async () => {
    mockFetchItineraryFull.mockResolvedValue(NO_GOALS)
    mockPutTripGoals.mockResolvedValue([CULTURAL_GOAL])

    render(<ItineraryPageClient />)
    await screen.findByText(/choose from presets/i)

    fireEvent.click(screen.getByRole("button", { name: "Cultural experiences" }))
    fireEvent.click(screen.getByRole("button", { name: /save goals/i }))

    // Wait for the chip to appear (confirming save succeeded)
    await screen.findByText("Cultural experiences")
    expect(
      screen.queryByText(/failed to save goals/i),
    ).not.toBeInTheDocument()
  })

  it("no error message after a successful remove", async () => {
    mockFetchItineraryFull.mockResolvedValue(WITH_TWO_GOALS)
    mockPutTripGoals.mockResolvedValue([ADVENTURE_GOAL])

    render(<ItineraryPageClient />)
    await screen.findByText("Cultural experiences")

    fireEvent.click(
      screen.getByRole("button", { name: /remove cultural experiences/i }),
    )

    // Cultural chip gone after remove
    await waitFor(() => {
      expect(screen.queryByText("Cultural experiences")).not.toBeInTheDocument()
    })
    expect(
      screen.queryByText(/failed to save goals/i),
    ).not.toBeInTheDocument()
  })
})

// ── Error shown in both sidebar branches ───────────────────────────────────────

describe("goalError — renders in correct sidebar branch", () => {
  it("error appears in GoalSelector branch (no goals loaded)", async () => {
    mockFetchItineraryFull.mockResolvedValue(NO_GOALS)
    mockPutTripGoals.mockRejectedValue(new Error("500"))

    render(<ItineraryPageClient />)
    await screen.findByText(/choose from presets/i)

    fireEvent.click(screen.getByRole("button", { name: "Cultural experiences" }))
    fireEvent.click(screen.getByRole("button", { name: /save goals/i }))

    await screen.findByText(/failed to save goals/i)
    // GoalSelector still shown — user can retry
    expect(screen.getByText(/choose from presets/i)).toBeInTheDocument()
  })

  it("error appears in chips branch (goals already loaded, remove fails)", async () => {
    mockFetchItineraryFull.mockResolvedValue(WITH_ONE_GOAL)
    mockPutTripGoals.mockRejectedValue(new Error("500"))

    render(<ItineraryPageClient />)
    await screen.findByText("Cultural experiences")

    fireEvent.click(
      screen.getByRole("button", { name: /remove cultural experiences/i }),
    )

    // Error appears
    await screen.findByText(/failed to save goals/i)
    // Chip is restored by rollback
    expect(screen.getByText("Cultural experiences")).toBeInTheDocument()
  })
})

// ── P3 cosmetic gap: error persists while retry is in-flight ──────────────────
//
// When a save fails and the user immediately retries, goalError is NOT cleared at
// the start of the retry attempt — it only clears on success. This means the error
// paragraph remains visible during the in-flight retry.
// This test documents the current behaviour. If the developer clears goalError at
// retry start, update the final assertion to expect NOT.toBeInTheDocument().

describe("goalError — P3 gap: stale error visible during retry in-flight", () => {
  it("error message is still visible while a retry is in-flight", async () => {
    mockFetchItineraryFull.mockResolvedValue(NO_GOALS)

    // First call rejects; second call hangs indefinitely (simulates slow network)
    mockPutTripGoals
      .mockRejectedValueOnce(new Error("500"))
      .mockReturnValue(new Promise(() => {}))

    render(<ItineraryPageClient />)
    await screen.findByText(/choose from presets/i)

    // First save: select a goal, save, fail
    fireEvent.click(screen.getByRole("button", { name: "Cultural experiences" }))
    fireEvent.click(screen.getByRole("button", { name: /save goals/i }))

    // Error appears; GoalSelector back; draftGoals preserved
    await screen.findByText(/failed to save goals/i)

    // Retry — the optimistic update (setGoals(draftGoals)) fires immediately,
    // switching to the chips branch and removing the "Save goals" button.
    // Verify: chips appear (optimistic), second PUT call made, error still visible.
    fireEvent.click(screen.getByRole("button", { name: /save goals/i }))

    await waitFor(() => {
      // Optimistic update: chip for the selected goal appears
      expect(screen.getByText("Cultural experiences")).toBeInTheDocument()
    })
    // Second putTripGoals call is in-flight (hanging mock)
    expect(mockPutTripGoals).toHaveBeenCalledTimes(2)
    // Error is still displayed — not cleared at retry start (current behaviour)
    expect(screen.getByText(/failed to save goals/i)).toBeInTheDocument()
  })
})
