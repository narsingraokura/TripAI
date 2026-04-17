import type { Suggestion } from "@/lib/api"
import SuggestionCard from "./SuggestionCard"

type SuggestionPanelProps = {
  loading: boolean
  error: string | null
  suggestions: Suggestion[] | null
  onSelect: (s: Suggestion) => void
}

export default function SuggestionPanel({
  loading,
  error,
  suggestions,
  onSelect,
}: SuggestionPanelProps) {
  if (loading) {
    return (
      <div aria-label="Loading suggestions" className="space-y-2 pt-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-slate-200 rounded-md animate-pulse" />
        ))}
      </div>
    )
  }

  if (error) {
    return <p className="text-xs text-red-600 pt-2">{error}</p>
  }

  if (!suggestions) return null

  return (
    <div className="space-y-2 pt-3">
      {suggestions.map((s) => (
        <SuggestionCard key={s.title} suggestion={s} onSelect={() => onSelect(s)} />
      ))}
    </div>
  )
}
