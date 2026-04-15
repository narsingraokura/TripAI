"use client"  // ← NEW. Tells Next.js this component uses browser APIs (useState)

import { useState } from "react"
import { Progress } from "@/components/ui/progress"
import { Checkbox } from "@/components/ui/checkbox"

type Urgency = "fire" | "now" | "soon"

type Booking = {
  id: string
  title: string
  subtitle: string
  urgency: Urgency
  estimatedCost: number
  actualCost?: number
  deadline: string
  category: string
  discountCode?: string
  cardTip: string
}

const BOOKINGS: Booking[] = [
  { id:"b1", title:"Flights: SFO → LHR + MXP → SFO", subtitle:"Jun 19 depart · Jul 5 return", urgency:"fire", estimatedCost:4800, deadline:"This week", category:"flights", cardTip:"Amex Gold (3X MR) + Venture X $300 credit on return" },
  { id:"b2", title:"Eurostar: London → Paris", subtitle:"Tue Jun 23 · morning", urgency:"fire", estimatedCost:400, deadline:"This week", category:"trains", discountCode:"Standard Premier", cardTip:"Venture X (no FX fee)" },
  { id:"b3", title:"Hotel Metropole Interlaken", subtitle:"Jun 27–Jul 1 · 5 nights", urgency:"fire", estimatedCost:1300, deadline:"This week", category:"hotels", cardTip:"Venture X (no FX fee on CHF)" },
  { id:"b4", title:"Skydive Interlaken deposit", subtitle:"Parents only · Jul 1", urgency:"fire", estimatedCost:100, deadline:"This week", category:"activities", cardTip:"Full payment ~$840 on the day" },
  { id:"b5", title:"Crowne Plaza London Kings Cross", subtitle:"Jun 20–22 · 3 nights", urgency:"now", estimatedCost:870, deadline:"This week", category:"hotels", discountCode:"100270748", cardTip:"Amex Gold via AmexTravel (2X MR)" },
  { id:"b6", title:"Novotel Paris Les Halles", subtitle:"Jun 23–26 · 4 nights · anniversary Jun 26", urgency:"now", estimatedCost:1000, deadline:"This week", category:"hotels", discountCode:"SC196337864", cardTip:"Venture X or Amex Gold" },
  { id:"b7", title:"Hyatt Centric Milan Centrale", subtitle:"Jul 2–4 · 3 nights", urgency:"now", estimatedCost:735, deadline:"This week", category:"hotels", discountCode:"151340", cardTip:"Amex Gold via AmexTravel (2X MR)" },
  { id:"b8", title:"Train: Paris → Basel → Interlaken", subtitle:"Sat Jun 27 · birthday", urgency:"now", estimatedCost:280, deadline:"This week", category:"trains", cardTip:"Venture X (no FX fee)" },
  { id:"b9", title:"Eiffel Tower tickets", subtitle:"Jun 24 · opens Apr 25", urgency:"soon", estimatedCost:150, deadline:"Apr 25", category:"activities", cardTip:"Venture X (no FX fee on EUR)" },
  { id:"b10", title:"Louvre timed entry · Jun 25, 9am", subtitle:"Required in summer", urgency:"soon", estimatedCost:100, deadline:"Late April", category:"activities", cardTip:"Venture X" },
  { id:"b11", title:"Anniversary dinner · Jun 26, Paris", subtitle:"Septime or Frenchie", urgency:"soon", estimatedCost:300, deadline:"May", category:"food", cardTip:"Amex Gold (no FX fee)" },
  { id:"b12", title:"Train: Interlaken → Milan · Jul 2", subtitle:"Book 4–6 weeks out", urgency:"soon", estimatedCost:200, deadline:"May", category:"trains", cardTip:"Venture X (no FX fee)" },
  { id:"b13", title:"Milan Duomo rooftop · Jul 3", subtitle:"Book in advance", urgency:"soon", estimatedCost:80, deadline:"May", category:"activities", cardTip:"Venture X (no FX fee on EUR)" },
  { id:"b14", title:"Airalo eSIM · 4 devices", subtitle:"EU + UK data bundle", urgency:"soon", estimatedCost:90, deadline:"Jun 12", category:"misc", cardTip:"Any card — ~$90 total" },
]

const BUDGET_CAP = 25000

const urgencyConfig: Record<Urgency, { label: string; className: string }> = {
  fire: { label: "Book now",  className: "bg-red-100 text-red-800 border-red-200" },
  now:  { label: "This week", className: "bg-amber-100 text-amber-800 border-amber-200" },
  soon: { label: "Upcoming",  className: "bg-slate-100 text-slate-700 border-slate-200" },
}

// BookingRow now receives checked + onToggle from parent
function BookingRow({
  booking,
  checked,
  onToggle,
}: {
  booking: Booking
  checked: boolean
  onToggle: (id: string) => void
}) {
  const { label, className } = urgencyConfig[booking.urgency]

  return (
    <div className={`flex items-start gap-3 py-3 border-b border-slate-100 last:border-0 ${checked ? "opacity-60" : ""}`}>
      <Checkbox
        checked={checked}
        onCheckedChange={() => onToggle(booking.id)}
        className="mt-1 shrink-0"
      />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${checked ? "line-through text-slate-400" : "text-slate-900"}`}>
          {booking.title}
        </p>
        <p className="text-xs text-slate-500 mt-0.5">{booking.subtitle}</p>
        {booking.discountCode && (
          <p className="text-xs font-mono bg-slate-50 border border-slate-200 rounded px-2 py-0.5 mt-1 inline-block">
            {booking.discountCode}
          </p>
        )}
        <p className="text-xs text-slate-400 mt-1">Card: {booking.cardTip}</p>
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
          ${(booking.actualCost ?? booking.estimatedCost).toLocaleString()}
        </p>
        <p className="text-xs text-slate-400 mt-0.5">{booking.deadline}</p>
      </div>
    </div>
  )
}

export default function Page() {
  // checkedIds is a Set — like an array but optimized for has/add/delete
  // Set makes it O(1) to check if a booking is checked
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())

  function handleToggle(id: string) {
    setCheckedIds(prev => {
      const next = new Set(prev)   // never mutate state directly — copy first
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const lockedIn = BOOKINGS
    .filter(b => checkedIds.has(b.id))
    .reduce((sum, b) => sum + (b.actualCost ?? b.estimatedCost), 0)

  const remaining  = BUDGET_CAP - lockedIn
  const progressPct = Math.round((lockedIn / BUDGET_CAP) * 100)

  const sections = [
    { label: "Book immediately",   bookings: BOOKINGS.filter(b => b.urgency === "fire" && !checkedIds.has(b.id)) },
    { label: "Book this week",     bookings: BOOKINGS.filter(b => b.urgency === "now"  && !checkedIds.has(b.id)) },
    { label: "Upcoming deadlines", bookings: BOOKINGS.filter(b => b.urgency === "soon" && !checkedIds.has(b.id)) },
    { label: "Done",               bookings: BOOKINGS.filter(b => checkedIds.has(b.id)) },
  ].filter(s => s.bookings.length > 0)

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="bg-slate-900 text-white px-4 py-8 text-center">
        <p className="text-xs tracking-widest text-slate-400 uppercase mb-1 font-mono">
          Kura Family · 4 travelers
        </p>
        <h1 className="text-3xl font-light mb-1">Europe 2026</h1>
        <p className="text-sm text-slate-400">
          Jun 19 – Jul 5 &nbsp;·&nbsp; London · Paris · Interlaken · Milan
        </p>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Bookings done", value: `${checkedIds.size}/${BOOKINGS.length}` },
            { label: "Locked in",     value: `$${lockedIn.toLocaleString()}` },
            { label: "Remaining",     value: `$${remaining.toLocaleString()}` },
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
                checked={checkedIds.has(booking.id)}
                onToggle={handleToggle}
              />
            ))}
          </div>
        ))}

      </div>
    </main>
  )
}