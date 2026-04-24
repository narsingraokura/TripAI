"use client"

import { useState } from "react"
import type { Constraint, Day, Goal, Resolution } from "@/types/itinerary"
import {
  ConstraintEditor,
  GoalSelector,
  GoalSuggestionCard,
  ItineraryDayCard,
} from "@/components/itinerary"

// ── Mock data ───────────────────────────────────────────────────────────────────

const INITIAL_GOALS: Goal[] = [
  { id: "preset-Cultural experiences", label: "Cultural experiences", isPreset: true },
  { id: "preset-Family-friendly activities", label: "Family-friendly activities", isPreset: true },
]

const INITIAL_CONSTRAINTS: Constraint[] = [
  {
    id: "c1",
    type: "budget",
    description: "Max $5,000 for hotels",
    value: "$5,000",
    status: "ok",
  },
  {
    id: "c2",
    type: "pace",
    description: "No more than 2 busy days in a row",
    status: "warning",
  },
  {
    id: "c3",
    type: "dietary",
    description: "No shellfish for the kids",
    status: "ok",
  },
]

const MOCK_DAYS: Day[] = [
  {
    id: "d1",
    date: "2026-06-20",
    city: "London",
    country: "UK",
    dayType: "leisure",
    activities: [
      { id: "a1", name: "Borough Market Food Tour", category: "food", cost: 45, durationMinutes: 90 },
      { id: "a2", name: "Tower Bridge Walk", category: "sightseeing", cost: 0, durationMinutes: 60 },
      { id: "a3", name: "Natural History Museum", category: "culture", cost: 0, durationMinutes: 120 },
    ],
  },
  {
    id: "d2",
    date: "2026-06-21",
    city: "London",
    country: "UK",
    dayType: "sightseeing",
    activities: [
      { id: "a4", name: "Westminster Abbey", category: "culture", cost: 35, durationMinutes: 90 },
      { id: "a5", name: "Big Ben & Parliament", category: "sightseeing", cost: 0, durationMinutes: 45 },
    ],
  },
  {
    id: "d3",
    date: "2026-06-22",
    city: "Paris",
    country: "France",
    dayType: "travel",
    activities: [
      { id: "a6", name: "Eurostar London → Paris", category: "transport", cost: 400, durationMinutes: 140 },
    ],
  },
  {
    id: "d4",
    date: "2026-06-23",
    city: "Paris",
    country: "France",
    dayType: "sightseeing",
    activities: [
      { id: "a7", name: "Eiffel Tower", category: "sightseeing", cost: 28, durationMinutes: 120 },
      { id: "a8", name: "Seine River Walk", category: "outdoor", cost: 0, durationMinutes: 60 },
      { id: "a9", name: "Café Lunch — Le Marais", category: "food", cost: 80, durationMinutes: 60 },
    ],
  },
  {
    id: "d5",
    date: "2026-06-24",
    city: "Paris",
    country: "France",
    dayType: "special",
    activities: [],
    notes: "Free day — no planned activities",
  },
]

const VIOLATION_RESOLUTIONS: Resolution[] = [
  { label: "Switch to Novotel alternative", description: "Saves $230 vs current Crowne Plaza rate" },
  { label: "Reduce Milan stay by 1 night", description: "Check out Jul 4 instead of Jul 5 — saves $245" },
]

// ── Demo component ──────────────────────────────────────────────────────────────

export default function ItineraryDemoContent() {
  const [goals, setGoals] = useState<Goal[]>(INITIAL_GOALS)
  const [constraints, setConstraints] = useState<Constraint[]>(INITIAL_CONSTRAINTS)
  const [expandedDay, setExpandedDay] = useState<string | null>(null)
  const [okCardKey, setOkCardKey] = useState(0)
  const [okDismissed, setOkDismissed] = useState(false)

  function toggleDay(id: string) {
    setExpandedDay((prev) => (prev === id ? null : id))
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-12">
      <header>
        <p className="text-xs font-mono text-slate-400 mb-1">Component demo</p>
        <h1 className="text-2xl font-bold text-slate-900">Itinerary Editor Library</h1>
        <p className="text-slate-500 text-sm mt-1">5-day Europe mock trip · All variants shown</p>
      </header>

      {/* ── Goal Selector ── */}
      <section>
        <h2 className="text-base font-semibold text-slate-800 mb-4">GoalSelector</h2>
        <GoalSelector selectedGoals={goals} onGoalsChange={setGoals} />
      </section>

      {/* ── Constraint Editor ── */}
      <section>
        <h2 className="text-base font-semibold text-slate-800 mb-4">ConstraintEditor</h2>
        <ConstraintEditor
          constraints={constraints}
          onConstraintsChange={setConstraints}
        />
      </section>

      {/* ── Itinerary Day Cards ── */}
      <section>
        <h2 className="text-base font-semibold text-slate-800 mb-4">ItineraryDayCard</h2>
        <div className="space-y-2">
          {MOCK_DAYS.map((day, i) => (
            <ItineraryDayCard
              key={day.id}
              day={day}
              dayNumber={i + 1}
              isExpanded={expandedDay === day.id}
              onToggleExpand={() => toggleDay(day.id)}
            />
          ))}
        </div>
      </section>

      {/* ── GoalSuggestionCard variants ── */}
      <section>
        <h2 className="text-base font-semibold text-slate-800 mb-4">GoalSuggestionCard</h2>
        <div className="space-y-3">
          {/* ok — auto-dismisses after 3 s */}
          {okDismissed ? (
            <div className="flex items-center gap-3">
              <p className="text-sm text-slate-400 italic">ok card auto-dismissed after 3 s</p>
              <button
                type="button"
                onClick={() => {
                  setOkCardKey((k) => k + 1)
                  setOkDismissed(false)
                }}
                className="text-xs underline text-slate-500 hover:text-slate-700"
              >
                Show again
              </button>
            </div>
          ) : (
            <GoalSuggestionCard
              key={okCardKey}
              status="ok"
              message="All goals are on track — great choices!"
              onDismiss={() => setOkDismissed(true)}
            />
          )}

          {/* warning — persistent */}
          <GoalSuggestionCard
            status="warning"
            message="Day 3 (Paris travel day) has no backup plan if Eurostar is delayed."
            field="Jun 22"
          />

          {/* violation — with resolutions */}
          <GoalSuggestionCard
            status="violation"
            message="Hotel budget exceeds your $5,000 constraint by $870."
            field="budget"
            resolutions={VIOLATION_RESOLUTIONS}
            onApply={(r) => alert(`Applied: ${r.label}`)}
          />
        </div>
      </section>
    </div>
  )
}
