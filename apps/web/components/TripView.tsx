"use client"

import { useState, useEffect, useCallback } from "react"
import { Progress } from "@/components/ui/progress"
import { fetchBookings, patchBooking, createBooking, deleteBooking } from "@/lib/api"
import type {
  Booking,
  BookingCategory,
  BookingSummary,
  BookingStatus,
  BookingUpdate,
  BookingCreate,
  Urgency,
} from "@/lib/api"
import { useIsDemo } from "@/components/DemoModeProvider"
import BookingRow from "@/components/BookingRow"
import AddBookingForm from "@/components/AddBookingForm"
import UndoToast from "@/components/UndoToast"

// TODO: Read from trips.budget_cap column instead of hardcoding
const BUDGET_CAP = 25_000

const URGENCY_ORDER: Record<Urgency, number> = { fire: 0, now: 1, soon: 2, later: 3 }

function computeSummary(bookings: Booking[]): BookingSummary {
  const lockedIn = bookings
    .filter((b) => b.status === "booked")
    .reduce((sum, b) => sum + (b.actual_cost ?? b.estimated_cost), 0)
  return {
    total_estimated: bookings.reduce((sum, b) => sum + b.estimated_cost, 0),
    total_actual: bookings
      .filter((b) => b.actual_cost != null)
      .reduce((sum, b) => sum + b.actual_cost!, 0),
    locked_in: lockedIn,
    remaining: BUDGET_CAP - lockedIn,
    booked_count: bookings.filter((b) => b.status === "booked").length,
    total_count: bookings.length,
  }
}

function sortByUrgency(bookings: Booking[]): Booking[] {
  return [...bookings].sort(
    (a, b) =>
      (URGENCY_ORDER[a.urgency] ?? 99) - (URGENCY_ORDER[b.urgency] ?? 99),
  )
}

export default function TripView() {
  const isDemo = useIsDemo()
  const [loadState, setLoadState] = useState<"loading" | "success" | "error">("loading")
  const [bookings, setBookings] = useState<Booking[]>([])
  const [summary, setSummary] = useState<BookingSummary | null>(null)
  const [undoBooking, setUndoBooking] = useState<Booking | null>(null)
  const [undoError, setUndoError] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addSubmitting, setAddSubmitting] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoadState("loading")
    try {
      const result = await fetchBookings()
      setBookings(result.bookings)
      setSummary(result.summary)
      setLoadState("success")
    } catch {
      setLoadState("error")
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const handleToggle = useCallback(
    async (id: string, currentStatus: BookingStatus) => {
      const newStatus: BookingStatus = currentStatus === "booked" ? "pending" : "booked"
      const snapshot = bookings
      const updated = bookings.map((b) =>
        b.id === id ? { ...b, status: newStatus } : b,
      )
      setBookings(updated)
      setSummary(computeSummary(updated))
      try {
        await patchBooking(id, { status: newStatus })
      } catch {
        setBookings(snapshot)
        setSummary(computeSummary(snapshot))
      }
    },
    [bookings],
  )

  const handlePatch = useCallback(
    async (id: string, patch: BookingUpdate) => {
      const snapshot = bookings
      const updated = bookings.map((b) =>
        b.id === id ? { ...b, ...patch } : b,
      )
      setBookings(updated)
      setSummary(computeSummary(updated))
      try {
        await patchBooking(id, patch)
      } catch {
        setBookings(snapshot)
        setSummary(computeSummary(snapshot))
      }
    },
    [bookings],
  )

  const handleDelete = useCallback(
    async (id: string) => {
      const booking = bookings.find((b) => b.id === id)
      if (!booking) return
      const updated = bookings.filter((b) => b.id !== id)
      setBookings(updated)
      setSummary(computeSummary(updated))
      setUndoBooking(booking)
      try {
        await deleteBooking(id)
      } catch {
        setBookings(bookings)
        setSummary(computeSummary(bookings))
        setUndoBooking(null)
      }
    },
    [bookings],
  )

  const handleUndoDelete = useCallback(async () => {
    if (!undoBooking) return
    const bookingToRestore = undoBooking
    setUndoBooking(null)
    try {
      const recreated = await createBooking({
        title: bookingToRestore.title,
        subtitle: bookingToRestore.subtitle,
        category: bookingToRestore.category as BookingCategory,
        urgency: bookingToRestore.urgency,
        status: bookingToRestore.status,
        estimated_cost: bookingToRestore.estimated_cost,
        actual_cost: bookingToRestore.actual_cost,
        deadline: bookingToRestore.deadline,
        discount_code: bookingToRestore.discount_code,
        card_tip: bookingToRestore.card_tip,
      })
      const restored = sortByUrgency([...bookings, recreated])
      setBookings(restored)
      setSummary(computeSummary(restored))
    } catch {
      setUndoError("Could not undo. The booking was permanently deleted.")
    }
  }, [bookings, undoBooking])

  const handleExpireDelete = useCallback(() => {
    setUndoBooking(null)
  }, [])

  const handleAddBooking = useCallback(
    async (data: BookingCreate) => {
      setAddSubmitting(true)
      setAddError(null)
      try {
        const newBooking = await createBooking(data)
        const updated = sortByUrgency([...bookings, newBooking])
        setBookings(updated)
        setSummary(computeSummary(updated))
        setShowAddForm(false)
      } catch {
        setAddError("Could not add booking. Try again.")
      } finally {
        setAddSubmitting(false)
      }
    },
    [bookings],
  )

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
      <>
        {header}
        <div
          className="max-w-2xl mx-auto px-4 py-12 text-center text-slate-400"
          role="status"
          aria-label="Loading bookings"
        >
          Loading bookings…
        </div>
      </>
    )
  }

  if (loadState === "error" || !summary) {
    return (
      <>
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
      </>
    )
  }

  const progressPct = Math.round((summary.locked_in / BUDGET_CAP) * 100)

  const sections = [
    {
      label: "Book immediately",
      bookings: bookings.filter((b) => b.urgency === "fire" && b.status === "pending"),
    },
    {
      label: "Book this week",
      bookings: bookings.filter((b) => b.urgency === "now" && b.status === "pending"),
    },
    {
      label: "Upcoming deadlines",
      bookings: bookings.filter((b) => b.urgency === "soon" && b.status === "pending"),
    },
    {
      label: "No rush",
      bookings: bookings.filter((b) => b.urgency === "later" && b.status === "pending"),
    },
    {
      label: "Done",
      bookings: bookings.filter((b) => b.status === "booked"),
    },
  ].filter((s) => s.bookings.length > 0)

  return (
    <>
      {header}

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Bookings done", value: `${summary.booked_count}/${summary.total_count}` },
            { label: "Locked in", value: `$${Math.round(summary.locked_in).toLocaleString()}` },
            { label: "Remaining", value: `$${Math.round(summary.remaining).toLocaleString()}` },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-white rounded-xl border border-slate-200 p-3 text-center"
            >
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

        {sections.map((section) => (
          <div
            key={section.label}
            className="bg-white rounded-xl border border-slate-200 p-4"
          >
            <p className="text-xs font-mono uppercase tracking-widest text-slate-400 mb-3">
              {section.label}
            </p>
            {section.bookings.map((booking) => (
              <BookingRow
                key={booking.id}
                booking={booking}
                onToggle={handleToggle}
                onPatch={handlePatch}
                onDelete={handleDelete}
              />
            ))}
          </div>
        ))}

        {!isDemo && (
          showAddForm ? (
            <AddBookingForm
              submitting={addSubmitting}
              error={addError}
              onAdd={handleAddBooking}
              onCancel={() => { setShowAddForm(false); setAddError(null) }}
            />
          ) : (
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full text-sm text-slate-500 hover:text-slate-700 border border-dashed border-slate-300 rounded-xl py-3"
              aria-label="Add Booking"
            >
              + Add Booking
            </button>
          )
        )}
      </div>

      {undoBooking && (
        <UndoToast
          message={`"${undoBooking.title}" removed.`}
          onUndo={() => void handleUndoDelete()}
          onExpire={handleExpireDelete}
        />
      )}
      {undoError && (
        <div className="fixed bottom-4 right-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 shadow-lg">
          {undoError}
        </div>
      )}
    </>
  )
}
