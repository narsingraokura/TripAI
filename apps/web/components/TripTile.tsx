"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

type TripTileDemoProps = {
  variant: "demo"
  tripId: string
  tripName: string
  dateRange: string
  cities: string[]
  href: string
}

type TripTileNewProps = {
  variant: "new"
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

function DemoTile({ tripId, tripName, dateRange, cities, href }: TripTileDemoProps) {
  const [stats, setStats] = useState<LiveStats | null>(null)
  const [loading, setLoading] = useState(true)

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
        // silently fail — no error shown to user
      })
      .finally(() => setLoading(false))
  }, [tripId])

  return (
    <div className="rounded-xl border border-border bg-card p-6 min-h-[280px] flex flex-col justify-between shadow-sm">
      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">{tripName}</h2>
          <p className="text-sm text-muted-foreground">{dateRange}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {cities.map((city) => (
            <Badge key={city} variant="secondary">
              {city}
            </Badge>
          ))}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <div className="flex items-center justify-between text-sm">
          {loading || !stats ? (
            <span className="text-muted-foreground">Loading trip data...</span>
          ) : (
            <>
              <span className="font-medium">
                {stats.booked} / {stats.total} booked
              </span>
              <span className="text-muted-foreground">
                {usd.format(stats.lockedIn)} locked in
              </span>
            </>
          )}
        </div>
        <Link href={href}>
          <Button className="w-full">Explore trip →</Button>
        </Link>
      </div>
    </div>
  )
}

function NewTile() {
  return (
    <div className="rounded-xl border-2 border-dashed border-border bg-background min-h-[280px] flex flex-col items-center justify-center gap-3 text-center p-6">
      <span className="text-4xl font-light text-muted-foreground" aria-hidden="true">
        +
      </span>
      <p className="text-base font-medium">Plan a new trip</p>
      <Badge variant="outline">Coming soon</Badge>
    </div>
  )
}

export default function TripTile(props: TripTileProps) {
  if (props.variant === "demo") return <DemoTile {...props} />
  return <NewTile />
}
