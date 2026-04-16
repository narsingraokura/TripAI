import ItineraryView from "@/components/itinerary/ItineraryView"

export default function ItineraryPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Itinerary</h1>
          <p className="text-slate-500 text-sm mt-1">
            Kura Family Europe 2026 · 17 days
          </p>
        </header>
        <ItineraryView />
      </div>
    </main>
  )
}
