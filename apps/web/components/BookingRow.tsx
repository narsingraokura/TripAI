"use client"

import { useState } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { useIsDemo } from "@/components/DemoModeProvider"
import type { Booking, BookingStatus, BookingUpdate, Urgency } from "@/lib/api"

const urgencyConfig: Record<Urgency, { label: string; className: string }> = {
  fire: { label: "Book now",  className: "bg-red-100 text-red-800 border-red-200" },
  now:  { label: "This week", className: "bg-amber-100 text-amber-800 border-amber-200" },
  soon: { label: "Upcoming",  className: "bg-slate-100 text-slate-700 border-slate-200" },
  later: { label: "No rush",  className: "bg-slate-50 text-slate-500 border-slate-200" },
}

type BookingRowProps = {
  booking: Booking
  onToggle: (id: string, currentStatus: BookingStatus) => void
  onPatch: (id: string, patch: BookingUpdate) => void
  onDelete: (id: string) => void
}

export default function BookingRow({ booking, onToggle, onPatch, onDelete }: BookingRowProps) {
  const isDemo = useIsDemo()
  const checked = booking.status === "booked"
  const { label, className } = urgencyConfig[booking.urgency] ?? urgencyConfig.soon
  const displayCost = booking.actual_cost ?? booking.estimated_cost

  const [editingCost, setEditingCost] = useState(false)
  const [costDraft, setCostDraft] = useState("")
  const [confirming, setConfirming] = useState(false)

  function handleCostClick() {
    if (isDemo) return
    setCostDraft(String(displayCost))
    setEditingCost(true)
  }

  function handleCostSave() {
    setEditingCost(false)
    const num = parseFloat(costDraft)
    if (!isNaN(num) && num >= 0) {
      onPatch(booking.id, { actual_cost: num })
    }
  }

  function handleCostKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleCostSave()
    if (e.key === "Escape") setEditingCost(false)
  }

  return (
    <div
      className={`flex items-start gap-3 py-3 border-b border-slate-100 last:border-0 ${checked ? "opacity-60" : ""}`}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={isDemo ? undefined : () => onToggle(booking.id, booking.status)}
        disabled={isDemo}
        aria-disabled={isDemo}
        className={`mt-1 shrink-0${isDemo ? " opacity-50 cursor-not-allowed" : ""}`}
      />

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${checked ? "line-through text-slate-400" : "text-slate-900"}`}>
          {booking.title}
        </p>
        {booking.subtitle && (
          <p className="text-xs text-slate-500 mt-0.5">{booking.subtitle}</p>
        )}
        {booking.discount_code && (
          <p className="text-xs font-mono bg-slate-50 border border-slate-200 rounded px-2 py-0.5 mt-1 inline-block">
            {booking.discount_code}
          </p>
        )}
        {booking.card_tip && (
          <p className="text-xs text-slate-400 mt-1">Card: {booking.card_tip}</p>
        )}
        {!checked && (
          <span className={`inline-block mt-1.5 text-xs font-medium px-2 py-0.5 rounded border ${className}`}>
            {label}
          </span>
        )}
        {checked && (
          <span className="inline-block mt-1.5 text-xs font-medium px-2 py-0.5 rounded border bg-green-50 text-green-700 border-green-200">
            Booked
          </span>
        )}
      </div>

      <div className="text-right shrink-0 flex flex-col items-end gap-1">
        {editingCost ? (
          <input
            type="number"
            value={costDraft}
            onChange={(e) => setCostDraft(e.target.value)}
            onBlur={handleCostSave}
            onKeyDown={handleCostKeyDown}
            className="w-24 text-sm font-semibold font-mono border border-slate-300 rounded px-2 py-0.5 text-right"
            autoFocus
          />
        ) : (
          <button
            onClick={handleCostClick}
            disabled={isDemo}
            className="text-sm font-semibold font-mono hover:underline disabled:cursor-default"
          >
            ${displayCost.toLocaleString()}
          </button>
        )}
        {booking.deadline && (
          <p className="text-xs text-slate-400">{booking.deadline}</p>
        )}
        {!isDemo && (
          confirming ? (
            <div className="flex items-center gap-1 mt-1">
              <button
                onClick={() => { setConfirming(false); onDelete(booking.id) }}
                className="text-xs text-white bg-red-600 hover:bg-red-700 px-2 py-0.5 rounded"
                aria-label="Confirm"
              >
                Confirm
              </button>
              <button
                onClick={() => setConfirming(false)}
                className="text-xs text-slate-500 hover:text-slate-700 px-2 py-0.5"
                aria-label="Cancel"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              className="text-xs text-slate-300 hover:text-red-400 mt-1"
              aria-label="Delete"
            >
              ✕
            </button>
          )
        )}
      </div>
    </div>
  )
}
