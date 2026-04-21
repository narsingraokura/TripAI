"use client"

import { useState, useEffect, useCallback } from "react"
import { Progress } from "@/components/ui/progress"
import { Checkbox } from "@/components/ui/checkbox"
import { fetchBookings, patchBookingStatus } from "@/lib/api"
import type { Booking, BookingsResponse, BookingStatus, Urgency } from "@/lib/api"
import { useIsDemo } from "@/components/DemoModeProvider"
import { DemoBanner } from "@/components/DemoBanner"

const BUDGET_CAP = 25000

const urgencyConfig: Record<Urgency, { label: string; className: string }> = {
  fire: { label: "Book now",  className: "bg-red-100 text-red-800 border-red-200" },
  now:  { label: "This week", className: "bg-amber-100 text-amber-800 border-amber-200" },
  soon: { label: "Upcoming",  className: "bg-slate-100 text-slate-700 border-slate-200" },
}

function BookingRow({
  booking,
  onToggle,
}: {
  booking: Booking
  onToggle: (id: string, currentStatus: BookingStatus) => void
}) {
  const checked = booking.status === "booked"
  const { label, className } = urgencyConfig[booking.urgency]
  const isDemo = useIsDemo()

  return (
    <div className={`flex items-start gap-3 py-3 border-b border-slate-100 last:border-0 ${checked ? "opacity-60" : ""}`}>
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
        <p className="text-xs text-slate-500 mt-0.5">{booking.subtitle}</p>
        {booking.discount_code && (
          <p className="text-xs font-mono bg-slate-50 border border-slate-200 rounded px-2 py-0.5 mt-1 inline-block">
            {booking.discount_code}
          </p>
        )}
        <p className="text-xs text-slate-400 mt-1">Card: {booking.card_tip}</p>
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
      <div className="text-right shrink-0">
        <p className="text-sm font-semibold font-mono">
          ${(booking.actual_cost ?? booking.estimated_cost).toLocaleString()}
        </p>
        <p className="text-xs text-slate-400 mt-0.5">{booking.deadline}</p>
      </div>
    </div>
  )
}

export default function Page() {
  const [loadState, setLoadState] = useState<"loading" | "success" | "error">("loading")
  const [data, setData] = useState<BookingsResponse | null>(null)

  const load = useCallback(async () => {
    setLoadState("loading")
    try {
      const result = await fetchBookings()
      setData(result)
      setLoadState("success")
    } catch {
      setLoadState("error")
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function handleToggle(id: string, currentStatus: BookingStatus) {
    if (!data) return
    const newStatus: BookingStatus = currentStatus === "booked" ? "pending" : "booked"

    // Optimistic update
    setData(prev =>
      prev
        ? { ...prev, bookings: prev.bookings.map(b => b.id === id ? { ...b, status: newStatus } : b) }
        : prev,
    )

    try {
      await patchBookingStatus(id, newStatus)
      const fresh = await fetchBookings()
      setData(fresh)
    } catch {
      // Revert on failure
      setData(prev =>
        prev
          ? { ...prev, bookings: prev.bookings.map(b => b.id === id ? { ...b, status: currentStatus } : b) }
          : prev,
      )
    }
  }

  const header = (
    <div className="bg-slate-900 text-white px-4 py-8 text-center">
      <p className="text-xs tracking-widest text-slate-400 uppercase mb-1 font-mono">
        Kura Family · 4 travelers
      </p>
      <h1 className="text-3xl font-light mb-1">Europe 2026</h1>
      <p className="text-sm text-slate-400">
        Jun 19 – Jul 5 &nbsp;·&nbsp; London · Paris · Interlaken · Milan
      </p>
    </div>
  )

  if (loadState === "loading") {
    return (
      <main className="min-h-screen bg-slate-50">
        <DemoBanner />
        {header}
        <div
          className="max-w-2xl mx-auto px-4 py-12 text-center text-slate-400"
          role="status"
          aria-label="Loading bookings"
        >
          Loading bookings…
        </div>
      </main>
    )
  }

  if (loadState === "error" || !data) {
    return (
      <main className="min-h-screen bg-slate-50">
        <DemoBanner />
        {header}
        <div className="max-w-2xl mx-auto px-4 py-12 text-center">
          <p className="text-slate-600">
            Could not load bookings. Check that the API is running.
          </p>
          <button
            onClick={() => void load()}
            className="mt-3 text-sm underline text-slate-500"
          >
            Retry
          </button>
        </div>
      </main>
    )
  }

  const { bookings, summary } = data
  const progressPct = Math.round((summary.locked_in / BUDGET_CAP) * 100)

  const sections = [
    { label: "Book immediately",   bookings: bookings.filter(b => b.urgency === "fire" && b.status === "pending") },
    { label: "Book this week",     bookings: bookings.filter(b => b.urgency === "now"  && b.status === "pending") },
    { label: "Upcoming deadlines", bookings: bookings.filter(b => b.urgency === "soon" && b.status === "pending") },
    { label: "Done",               bookings: bookings.filter(b => b.status === "booked") },
  ].filter(s => s.bookings.length > 0)

  return (
    <main className="min-h-screen bg-slate-50">
      <DemoBanner />
      {header}

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Bookings done", value: `${summary.booked_count}/${summary.total_count}` },
            { label: "Locked in",     value: `$${summary.locked_in.toLocaleString()}` },
            { label: "Remaining",     value: `$${summary.remaining.toLocaleString()}` },
          ].map(stat => (
            <div key={stat.label} className="bg-white rounded-xl border border-slate-200 p-3 text-center">
              <p className="text-xl">{stat.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex justify-between text-xs text-slate-500 mb-2">
            <span>Budget locked in</span>
            <span>{progressPct}% of $25,000</span>
          </div>
          <Progress value={progressPct} className="h-3" />
          <div className="flex justify-between text-xs text-slate-400 mt-1.5">
            <span>$0</span>
            <span>$25,000 cap</span>
          </div>
        </div>

        {sections.map(section => (
          <div key={section.label} className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-mono uppercase tracking-widest text-slate-400 mb-3">
              {section.label}
            </p>
            {section.bookings.map(booking => (
              <BookingRow
                key={booking.id}
                booking={booking}
                onToggle={handleToggle}
              />
            ))}
          </div>
        ))}

      </div>
    </main>
  )
}
