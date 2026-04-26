"use client"

import { useState } from "react"
import type { ApiDayType } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const DAY_TYPES: { value: ApiDayType; label: string }[] = [
  { value: "exploration", label: "Exploration" },
  { value: "rest", label: "Rest" },
  { value: "transit", label: "Transit" },
]

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

type AddDayInlineFormProps = {
  defaultDate: string
  submitting: boolean
  error: string | null
  onAdd: (date: string, city: string, dayType: ApiDayType) => void
  onCancel: () => void
}

export default function AddDayInlineForm({
  defaultDate,
  submitting,
  error,
  onAdd,
  onCancel,
}: AddDayInlineFormProps) {
  const [date, setDate] = useState(defaultDate)
  const [city, setCity] = useState("")
  const [dayType, setDayType] = useState<ApiDayType>("exploration")

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!city.trim()) return
    onAdd(date, city.trim(), dayType)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="p-3 space-y-3 bg-blue-50 border border-blue-200 rounded-lg"
    >
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label htmlFor="add-day-date" className="block text-xs text-slate-500 mb-1">
            Date
          </label>
          <Input
            id="add-day-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            disabled={submitting}
            className="text-sm"
            aria-label="Date"
          />
        </div>

        <div>
          <label htmlFor="add-day-city" className="block text-xs text-slate-500 mb-1">
            City *
          </label>
          <Input
            id="add-day-city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="e.g. Rome"
            disabled={submitting}
            className="text-sm"
            aria-label="City"
          />
        </div>

        <div>
          <label htmlFor="add-day-type" className="block text-xs text-slate-500 mb-1">
            Day type
          </label>
          <select
            id="add-day-type"
            value={dayType}
            onChange={(e) => setDayType(e.target.value as ApiDayType)}
            disabled={submitting}
            aria-label="Day type"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {DAY_TYPES.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Show human-readable date hint */}
      <p className="text-xs text-slate-400">{formatDate(date)}</p>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={submitting || !city.trim()}>
          {submitting ? "Adding…" : "Add day"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}
