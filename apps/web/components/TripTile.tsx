"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

type TripTileDemoProps = {
  variant: "demo"
  tripId: string
  tripName: string
  family: string
  travelerCount: number
  dateRange: string
  cities: string[]
  href: string
}

type TripTileNewProps = {
  variant: "new"
  comingSoon: boolean
}

export type TripTileProps = TripTileDemoProps | TripTileNewProps

type LiveStats = {
  booked: number
  total: number
  lockedIn: number
}

type BookingsApiResponse = {
  summary: {
    booked_count: number
    total_count: number
    locked_in: number
  }
}

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
})

function DemoTile({ tripId, tripName, family, travelerCount, dateRange, cities, href }: TripTileDemoProps) {
  const [stats, setStats] = useState<LiveStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL
    if (!apiBase) {
      setLoading(false)
      return
    }

    fetch(`${apiBase}/trips/${tripId}/bookings`)
      .then((res) => {
        if (!res.ok) throw new Error(`API error: ${res.status}`)
        return res.json() as Promise<BookingsApiResponse>
      })
      .then((data) => {
        setStats({
          booked: data.summary.booked_count,
          total: data.summary.total_count,
          lockedIn: data.summary.locked_in,
        })
      })
      .catch(() => {
        setHasError(true)
      })
      .finally(() => setLoading(false))
  }, [tripId])

  return (
    <div className="rounded-xl border border-border bg-card p-6 min-h-[280px] flex flex-col justify-between shadow-sm hover:border-slate-400 hover:shadow-md transition-all">
      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">{tripName}</h2>
            <p className="text-sm text-muted-foreground">{family}</p>
          </div>
          <span className="text-xs font-mono uppercase bg-slate-100 text-slate-500 px-2 py-0.5 rounded">
            DEMO
          </span>
        </div>
        <p className="text-sm text-slate-400 font-mono">{dateRange}</p>
        <div className="flex flex-wrap gap-1.5">
          {cities.map((city) => (
            <Badge key={city} variant="secondary">
              {city}
            </Badge>
          ))}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {loading ? (
          <span className="text-sm text-muted-foreground">Loading trip data...</span>
        ) : !hasError && stats !== null ? (
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{travelerCount} travelers</span>
            <span>{usd.format(stats.lockedIn)} locked in</span>
            <span>
              {stats.booked} / {stats.total} booked
            </span>
          </div>
        ) : null}
        <Link href={href}>
          <Button className="w-full">Explore trip →</Button>
        </Link>
      </div>
    </div>
  )
}

function NewTile({ comingSoon }: TripTileNewProps) {
  return (
    <div className="rounded-xl border-2 border-dashed border-border bg-background min-h-[280px] flex flex-col items-center justify-center gap-3 text-center p-6">
      <span className="text-4xl font-light text-muted-foreground" aria-hidden="true">
        +
      </span>
      <p className="text-base font-medium">Plan a new trip</p>
      <p className="text-xs text-slate-400">
        Tell us your destinations, dates, and budget — we&apos;ll build the rest.
      </p>
      {comingSoon && <Badge variant="outline">Coming soon</Badge>}
    </div>
  )
}

export default function TripTile(props: TripTileProps) {
  if (props.variant === "demo") return <DemoTile {...props} />
  return <NewTile {...props} />
}
