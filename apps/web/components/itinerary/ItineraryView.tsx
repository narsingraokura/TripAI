"use client"

import { useState, useEffect, useCallback } from "react"
import {
  createItineraryDay,
  deleteItineraryDay,
  fetchItinerary,
  fetchSuggestions,
  patchItineraryDay,
} from "@/lib/api"
import type { ItineraryDay, ItineraryDayCreate, Intensity, Suggestion } from "@/lib/api"
import { Button } from "@/components/ui/button"
import AddDayForm from "./AddDayForm"
import CityGroup from "./CityGroup"
import { useIsDemo } from "@/components/DemoModeProvider"

type EditDraft = { title: string; plan: string; intensity: Intensity }

function groupByCity(days: ItineraryDay[]): Map<string, ItineraryDay[]> {
  const map = new Map<string, ItineraryDay[]>()
  for (const day of days) {
    const city = day.city ?? "Transit"
    const group = map.get(city)
    if (group) {
      group.push(day)
    } else {
      map.set(city, [day])
    }
  }
  return map
}

function LoadingSkeleton() {
  return (
    <div role="status" aria-label="Loading itinerary" className="space-y-8">
      {[1, 2, 3].map((i) => (
        <div key={i}>
          <div className="h-5 w-28 bg-slate-200 rounded animate-pulse mb-3" />
          <div className="space-y-2">
            {[1, 2, 3].map((j) => (
              <div
                key={j}
                className="h-12 bg-slate-200 rounded-lg animate-pulse"
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function ItineraryView() {
  const [days, setDays] = useState<ItineraryDay[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedDate, setExpandedDate] = useState<string | null>(null)
  const [editingDate, setEditingDate] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [suggestingDate, setSuggestingDate] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null)
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [suggestError, setSuggestError] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const isDemo = useIsDemo()

  const loadDays = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchItinerary()
      setDays(data)
    } catch {
      setError("Could not load itinerary")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadDays()
  }, [loadDays])

  const handleToggleExpand = useCallback((date: string) => {
    setExpandedDate((prev) => (prev === date ? null : date))
    setEditingDate(null)
    setEditDraft(null)
    setSaveError(null)
    setSuggestingDate(null)
    setSuggestions(null)
    setSuggestError(null)
  }, [])

  const handleSuggest = useCallback(async (date: string) => {
    setExpandedDate(date)
    setSuggestingDate(date)
    setSuggestions(null)
    setSuggestError(null)
    setSuggestLoading(true)
    try {
      const data = await fetchSuggestions(date)
      setSuggestions(data)
    } catch (err) {
      setSuggestError(err instanceof Error ? err.message : "Could not load suggestions. Try again.")
    } finally {
      setSuggestLoading(false)
    }
  }, [])

  const handleDeleteDay = useCallback(
    async (date: string) => {
      const snapshot = days
      setDays((prev) => prev.filter((d) => d.date !== date))
      try {
        await deleteItineraryDay(date)
      } catch {
        setDays(snapshot)
      }
    },
    [days],
  )

  const handleAddDay = useCallback(async (values: ItineraryDayCreate) => {
    const newDay = await createItineraryDay(values)
    setDays((prev) =>
      [...prev, newDay].sort((a, b) => a.date.localeCompare(b.date)),
    )
    setShowAddForm(false)
  }, [])

  const handleSelectSuggestion = useCallback(
    (s: Suggestion) => {
      if (!suggestingDate) return
      setEditingDate(suggestingDate)
      setEditDraft({ title: s.title, plan: s.description, intensity: s.intensity })
      setSuggestingDate(null)
      setSuggestions(null)
      setSuggestError(null)
      setSaveError(null)
    },
    [suggestingDate],
  )

  const handleStartEdit = useCallback(
    (date: string) => {
      const day = days.find((d) => d.date === date)
      if (!day) return
      setExpandedDate(date)
      setEditingDate(date)
      setEditDraft({ title: day.title, plan: day.plan, intensity: day.intensity })
      setSaveError(null)
    },
    [days],
  )

  const handleDraftChange = useCallback(
    (field: "title" | "plan" | "intensity", value: string) => {
      setEditDraft((prev) => {
        if (!prev) return prev
        if (field === "intensity") {
          const valid: Intensity[] = [
            "light",
            "moderate",
            "busy",
            "travel",
            "special",
          ]
          if (!valid.includes(value as Intensity)) return prev
          return { ...prev, intensity: value as Intensity }
        }
        return { ...prev, [field]: value }
      })
    },
    [],
  )

  const handleSave = useCallback(async () => {
    if (!editingDate || !editDraft) return
    const originalDay = days.find((d) => d.date === editingDate)
    if (!originalDay) return

    const optimistic: ItineraryDay = {
      ...originalDay,
      title: editDraft.title,
      plan: editDraft.plan,
      intensity: editDraft.intensity,
    }

    setDays((prev) =>
      prev.map((d) => (d.date === editingDate ? optimistic : d)),
    )
    setSaving(true)
    setSaveError(null)

    try {
      const result = await patchItineraryDay(editingDate, {
        title: editDraft.title,
        plan: editDraft.plan,
        intensity: editDraft.intensity,
      })
      if (result) {
        setDays((prev) => prev.map((d) => (d.date === editingDate ? result : d)))
      }
      setEditingDate(null)
      setEditDraft(null)
    } catch {
      setDays((prev) =>
        prev.map((d) => (d.date === editingDate ? originalDay : d)),
      )
      setSaveError("Failed to save")
    } finally {
      setSaving(false)
    }
  }, [editingDate, editDraft, days])

  const handleCancel = useCallback(() => {
    setEditingDate(null)
    setEditDraft(null)
    setSaveError(null)
    setSuggestingDate(null)
    setSuggestions(null)
    setSuggestError(null)
  }, [])

  if (loading) return <LoadingSkeleton />

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-600 mb-4">{error}</p>
        <Button variant="outline" onClick={loadDays}>
          Retry
        </Button>
      </div>
    )
  }

  const cityGroups = groupByCity(days)

  return (
    <div className="space-y-8">
      {!isDemo && (
        <div>
          {showAddForm ? (
            <AddDayForm onAdd={handleAddDay} onCancel={() => setShowAddForm(false)} />
          ) : (
            <Button variant="outline" size="sm" onClick={() => setShowAddForm(true)}>
              + Add day
            </Button>
          )}
        </div>
      )}
      {Array.from(cityGroups.entries()).map(([city, cityDays]) => (
        <CityGroup
          key={city}
          city={city}
          days={cityDays}
          expandedDate={expandedDate}
          editingDate={editingDate}
          draft={editDraft}
          saving={saving}
          saveError={saveError}
          suggestingDate={suggestingDate}
          suggestLoading={suggestLoading}
          suggestions={suggestions}
          suggestError={suggestError}
          onToggleExpand={handleToggleExpand}
          onStartEdit={handleStartEdit}
          onDraftChange={handleDraftChange}
          onSave={handleSave}
          onCancel={handleCancel}
          onSuggest={handleSuggest}
          onSelectSuggestion={handleSelectSuggestion}
          onDelete={handleDeleteDay}
        />
      ))}
    </div>
  )
}
