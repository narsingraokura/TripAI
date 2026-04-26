import TripView from "@/components/TripView"
import { DemoBanner } from "@/components/DemoBanner"

export default function TripPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <DemoBanner />
      <TripView />
    </main>
  )
}
