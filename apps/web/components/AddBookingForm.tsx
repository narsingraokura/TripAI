"use client"

import { useState } from "react"
import type { BookingCreate, BookingCategory, Urgency, BookingStatus } from "@/lib/api"

type AddBookingFormProps = {
  submitting: boolean
  error: string | null
  onAdd: (data: BookingCreate) => void
  onCancel: () => void
}

const CATEGORIES: BookingCategory[] = ["flights", "hotels", "trains", "activities", "food", "misc"]
const URGENCIES: Urgency[] = ["fire", "now", "soon", "later"]
const STATUSES: BookingStatus[] = ["pending", "booked"]

export default function AddBookingForm({ submitting, error, onAdd, onCancel }: AddBookingFormProps) {
  const [title, setTitle] = useState("")
  const [subtitle, setSubtitle] = useState("")
  const [category, setCategory] = useState<BookingCategory>("activities")
  const [urgency, setUrgency] = useState<Urgency>("soon")
  const [status, setStatus] = useState<BookingStatus>("pending")
  const [estimatedCost, setEstimatedCost] = useState(0)

  const canSubmit = title.trim().length > 0 && estimatedCost > 0 && !submitting

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    onAdd({
      title: title.trim(),
      subtitle: subtitle.trim() || undefined,
      category,
      urgency,
      status,
      estimated_cost: estimatedCost,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
      <p className="text-xs font-mono uppercase tracking-widest text-slate-400">New Booking</p>

      <div className="space-y-2">
        <label htmlFor="booking-title" className="block text-xs font-medium text-slate-700">
          Title
        </label>
        <input
          id="booking-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Eiffel Tower tickets"
          className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="booking-subtitle" className="block text-xs font-medium text-slate-700">
          Notes / Subtitle
        </label>
        <input
          id="booking-subtitle"
          type="text"
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
          placeholder="e.g. Jun 24 afternoon"
          className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label htmlFor="booking-category" className="block text-xs font-medium text-slate-700">
            Category
          </label>
          <select
            id="booking-category"
            value={category}
            onChange={(e) => setCategory(e.target.value as BookingCategory)}
            className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="booking-urgency" className="block text-xs font-medium text-slate-700">
            Urgency
          </label>
          <select
            id="booking-urgency"
            value={urgency}
            onChange={(e) => setUrgency(e.target.value as Urgency)}
            className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
          >
            {URGENCIES.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label htmlFor="booking-cost" className="block text-xs font-medium text-slate-700">
            Estimated Cost ($)
          </label>
          <input
            id="booking-cost"
            type="number"
            min={0}
            value={estimatedCost || ""}
            onChange={(e) => setEstimatedCost(parseFloat(e.target.value) || 0)}
            className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="booking-status" className="block text-xs font-medium text-slate-700">
            Status
          </label>
          <select
            id="booking-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as BookingStatus)}
            className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button
          type="submit"
          disabled={!canSubmit}
          className="text-sm font-medium px-4 py-1.5 rounded bg-slate-900 text-white disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Add Booking"
        >
          Add Booking
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-slate-500 hover:text-slate-700 px-2 py-1.5"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
