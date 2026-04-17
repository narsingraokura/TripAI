import type { Suggestion } from "@/lib/api"
import { Button } from "@/components/ui/button"
import IntensityBadge from "./IntensityBadge"

function formatCostDelta(delta: number): { text: string; className: string } {
  if (delta === 0) return { text: "same cost", className: "text-slate-500" }
  if (delta > 0) return { text: `+$${delta}`, className: "text-red-600 font-medium" }
  return { text: `-$${Math.abs(delta)}`, className: "text-green-600 font-medium" }
}

type SuggestionCardProps = {
  suggestion: Suggestion
  onSelect: () => void
}

export default function SuggestionCard({ suggestion, onSelect }: SuggestionCardProps) {
  const { text: costText, className: costClass } = formatCostDelta(suggestion.cost_delta)

  return (
    <div className="border border-slate-200 rounded-md p-3 bg-slate-50 space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-slate-800">{suggestion.title}</span>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs ${costClass}`}>{costText}</span>
          <IntensityBadge intensity={suggestion.intensity} />
        </div>
      </div>
      <p className="text-xs text-slate-600 leading-relaxed">{suggestion.description}</p>
      <p className="text-xs text-slate-400 italic">{suggestion.why_fits}</p>
      <div className="flex items-center justify-between pt-0.5">
        {suggestion.booking_required ? (
          <span className="text-xs text-amber-600">Booking required</span>
        ) : (
          <span className="text-xs text-slate-400">No booking needed</span>
        )}
        <Button size="sm" variant="outline" onClick={onSelect}>
          Use this →
        </Button>
      </div>
    </div>
  )
}
