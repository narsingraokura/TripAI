"use client"

import { useState, useEffect, useCallback } from "react"
import type {
  Activity,
  ActivityCategory,
  Constraint,
  ConstraintType,
  Day,
  DayType,
  Goal,
} from "@/types/itinerary"
import type { ApiConstraint, ApiConstraintType, ApiDay, ApiGoal } from "@/lib/api"
import {
  deleteTripConstraint,
  fetchItineraryFull,
  postTripConstraint,
  putTripGoals,
} from "@/lib/api"
import {
  ConstraintEditor,
  GoalChip,
  GoalSelector,
  ItineraryDayCard,
} from "@/components/itinerary"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// ── Type mappers ──────────────────────────────────────────────────────────────

function apiDayTypeToDayType(t: string): DayType {
  if (t === "transit") return "travel"
  if (t === "rest") return "rest"
  return "sightseeing"
}

function apiCategoryToFrontend(cat: string): ActivityCategory {
  const map: Record<string, ActivityCategory> = {
    food: "food",
    transit: "transport",
    sightseeing: "sightseeing",
    lodging: "accommodation",
    shopping: "shopping",
    activity: "misc",
  }
  return map[cat] ?? "misc"
}

function apiDayToDay(d: ApiDay): Day {
  return {
    id: d.id,
    date: d.date ?? "",
    city: d.city ?? "Transit",
    country: "",
    dayType: apiDayTypeToDayType(d.day_type),
    activities: d.activities.map(
      (a): Activity => ({
        id: a.id,
        name: a.title,
        category: apiCategoryToFrontend(a.category),
        cost: a.estimated_cost ?? 0,
        durationMinutes: 0,
      }),
    ),
    notes: d.notes ?? undefined,
  }
}

function apiGoalToGoal(g: ApiGoal): Goal {
  return { id: g.id, label: g.label, isPreset: g.goal_type === "preset" }
}

function apiConstraintTypeToFrontend(t: ApiConstraintType): ConstraintType {
  if (t === "budget_cap") return "budget"
  if (t === "time_constraint") return "dates"
  return "preference"
}

function constraintTypeToApi(t: ConstraintType): ApiConstraintType {
  if (t === "budget") return "budget_cap"
  if (t === "dates") return "time_constraint"
  return "custom"
}

function apiConstraintToConstraint(c: ApiConstraint): Constraint {
  return {
    id: c.id,
    type: apiConstraintTypeToFrontend(c.constraint_type),
    description: c.description,
    value: c.value != null ? String(c.value) : undefined,
    status: "ok",
  }
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div role="status" aria-label="Loading itinerary" className="space-y-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-12 bg-slate-200 rounded-lg animate-pulse" />
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ItineraryPageClient() {
  const [days, setDays] = useState<Day[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [draftGoals, setDraftGoals] = useState<Goal[]>([])
  const [constraints, setConstraints] = useState<Constraint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedDayId, setExpandedDayId] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [savingGoals, setSavingGoals] = useState(false)
  const [goalError, setGoalError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchItineraryFull()
      setDays(data.days.map(apiDayToDay))
      setGoals(data.goals.map(apiGoalToGoal))
      setConstraints(data.constraints.map(apiConstraintToConstraint))
    } catch {
      setError("Could not load itinerary")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedDayId((prev) => (prev === id ? null : id))
  }, [])

  const handleSaveGoals = useCallback(async () => {
    if (draftGoals.length === 0) return
    const snapshot = goals
    setSavingGoals(true)
    setGoals(draftGoals)
    try {
      const result = await putTripGoals(
        draftGoals.map((g) => ({
          goal_type: (g.isPreset ? "preset" : "custom") as "preset" | "custom",
          label: g.label,
        })),
      )
      setGoals(result.map(apiGoalToGoal))
      setDraftGoals([])
      setGoalError(null)
    } catch {
      setGoals(snapshot)
      setGoalError("Failed to save goals — please try again")
    } finally {
      setSavingGoals(false)
    }
  }, [draftGoals, goals])

  const handleRemoveGoal = useCallback(
    async (goalId: string) => {
      const snapshot = goals
      const newGoals = goals.filter((g) => g.id !== goalId)
      setGoals(newGoals)
      try {
        const result = await putTripGoals(
          newGoals.map((g) => ({
            goal_type: (g.isPreset ? "preset" : "custom") as "preset" | "custom",
            label: g.label,
          })),
        )
        setGoals(result.map(apiGoalToGoal))
        setGoalError(null)
      } catch {
        setGoals(snapshot)
        setGoalError("Failed to save goals — please try again")
      }
    },
    [goals],
  )

  const handleConstraintsChange = useCallback(
    async (newConstraints: Constraint[]) => {
      const added = newConstraints.filter(
        (c) => !constraints.some((old) => old.id === c.id),
      )
      const removed = constraints.filter(
        (old) => !newConstraints.some((c) => c.id === old.id),
      )

      setConstraints(newConstraints)

      for (const toAdd of added) {
        try {
          const result = await postTripConstraint({
            constraint_type: constraintTypeToApi(toAdd.type),
            description: toAdd.description,
          })
          const real = apiConstraintToConstraint(result)
          setConstraints((prev) => prev.map((c) => (c.id === toAdd.id ? real : c)))
        } catch {
          setConstraints((prev) => prev.filter((c) => c.id !== toAdd.id))
        }
      }

      for (const toRemove of removed) {
        // Only DELETE constraints that already exist in the backend (UUIDs).
        // Temp IDs created by ConstraintEditor start with "constraint-".
        if (!toRemove.id.startsWith("constraint-")) {
          try {
            await deleteTripConstraint(toRemove.id)
          } catch {
            setConstraints((prev) => {
              if (prev.some((c) => c.id === toRemove.id)) return prev
              return [...prev, toRemove]
            })
          }
        }
      }
    },
    [constraints],
  )

  if (loading) return <LoadingSkeleton />

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-600 mb-4">{error}</p>
        <Button variant="outline" onClick={() => void load()}>
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* ── Main: day list ──────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0">
        {days.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-500 mb-4">No days planned yet.</p>
            <Button variant="outline">Start planning your trip</Button>
          </div>
        ) : (
          <div className="space-y-2">
            {days.map((day, i) => (
              <ItineraryDayCard
                key={day.id}
                day={day}
                dayNumber={i + 1}
                isExpanded={expandedDayId === day.id}
                onToggleExpand={() => handleToggleExpand(day.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className="lg:w-72 shrink-0">
        {/* Mobile collapse toggle */}
        <button
          type="button"
          onClick={() => setSidebarOpen((prev) => !prev)}
          aria-expanded={sidebarOpen}
          aria-controls="sidebar-panel"
          className="lg:hidden w-full flex items-center justify-between px-4 py-3 mb-3 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700"
        >
          Goals &amp; Constraints
          <span aria-hidden="true">{sidebarOpen ? "▲" : "▼"}</span>
        </button>

        {/* Sidebar content — hidden on mobile when collapsed, always visible on desktop */}
        <div
          id="sidebar-panel"
          className={cn(!sidebarOpen && "hidden", "lg:block")}
        >
          {goalError && (
            <p className="text-sm text-red-600 mb-3">{goalError}</p>
          )}
          {goals.length === 0 ? (
            <div className="space-y-4">
              <GoalSelector
                selectedGoals={draftGoals}
                onGoalsChange={setDraftGoals}
              />
              <Button
                onClick={() => void handleSaveGoals()}
                disabled={draftGoals.length === 0 || savingGoals}
                className="w-full"
              >
                {savingGoals ? "Saving…" : "Save goals"}
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <p className="text-sm font-medium text-slate-700 mb-2">
                  Your goals
                </p>
                <div className="flex flex-wrap gap-2">
                  {goals.map((g) => (
                    <GoalChip
                      key={g.id}
                      label={g.label}
                      selected
                      isCustom={!g.isPreset}
                      onRemove={() => void handleRemoveGoal(g.id)}
                    />
                  ))}
                </div>
              </div>
              <ConstraintEditor
                constraints={constraints}
                onConstraintsChange={(c) => void handleConstraintsChange(c)}
              />
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}
