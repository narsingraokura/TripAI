import ItineraryPageClient from "@/components/itinerary/ItineraryPageClient"
import { DemoBanner } from "@/components/DemoBanner"

export default function ItineraryPlannerPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <DemoBanner />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Itinerary Planner</h1>
          <p className="text-slate-500 text-sm mt-1">
            Kura Family Europe 2026 · Set goals, manage constraints, and plan your days
          </p>
        </header>
        <ItineraryPageClient />
      </div>
    </main>
  )
}
