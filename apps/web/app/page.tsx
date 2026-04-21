import TripTile from "@/components/TripTile"

const DEMO_TRIP = {
  tripId: process.env.NEXT_PUBLIC_TRIP_ID ?? "",
  tripName: "Europe 2026",
  dateRange: "Jun 19 – Jul 5",
  cities: ["London", "Paris", "Interlaken", "Milan"],
  href: "/trip",
}

export default function LandingPage() {
  return (
    <main className="min-h-svh bg-slate-50">
      <div className="max-w-4xl mx-auto px-6 py-16 md:py-20">

        <header className="mb-10">
          <p className="text-sm font-semibold font-mono text-slate-900 tracking-tight mb-4">
            TripAI
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            Plan smarter. Travel lighter.
          </h1>
          <p className="mt-2 text-base text-slate-500">
            Track bookings, manage your budget, and ask your AI travel assistant.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <TripTile variant="demo" {...DEMO_TRIP} />
          <TripTile variant="new" />
        </div>

      </div>
    </main>
  )
}
