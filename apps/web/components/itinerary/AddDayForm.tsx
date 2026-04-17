import { useState } from "react"
import type { Intensity, ItineraryDayCreate } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const INTENSITIES: Intensity[] = ["light", "moderate", "busy", "travel", "special"]

type AddDayFormProps = {
  onAdd: (values: ItineraryDayCreate) => Promise<void>
  onCancel: () => void
}

export default function AddDayForm({ onAdd, onCancel }: AddDayFormProps) {
  const [date, setDate] = useState("")
  const [city, setCity] = useState("")
  const [country, setCountry] = useState("")
  const [title, setTitle] = useState("")
  const [intensity, setIntensity] = useState<Intensity>("light")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!date || !city || !title) {
      setError("Date, city, and title are required")
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onAdd({ date, city, country, title, intensity })
    } catch {
      setError("Failed to add day. Try again.")
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="p-4 space-y-3 bg-white border border-slate-200 rounded-lg"
    >
      <h3 className="text-sm font-semibold text-slate-800">Add day</h3>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Date *</label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            disabled={submitting}
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Intensity</label>
          <select
            value={intensity}
            onChange={(e) => setIntensity(e.target.value as Intensity)}
            disabled={submitting}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {INTENSITIES.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs text-slate-500 mb-1">Title *</label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Arrive CDG, explore Montmartre"
          disabled={submitting}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-500 mb-1">City *</label>
          <Input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="e.g. Paris"
            disabled={submitting}
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Country</label>
          <Input
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="e.g. France"
            disabled={submitting}
          />
        </div>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={submitting}>
          {submitting ? "Adding…" : "Add day"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}
