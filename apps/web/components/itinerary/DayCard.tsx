import { ChevronDown, ChevronUp } from "lucide-react"
import type { ItineraryDay, Intensity } from "@/lib/api"
import { Button } from "@/components/ui/button"
import IntensityBadge from "./IntensityBadge"
import DayEditor from "./DayEditor"

type DayCardProps = {
  day: ItineraryDay
  isExpanded: boolean
  isEditing: boolean
  draft: { title: string; plan: string; intensity: Intensity } | null
  saving: boolean
  saveError: string | null
  onToggleExpand: () => void
  onStartEdit: () => void
  onDraftChange: (field: "title" | "plan" | "intensity", value: string) => void
  onSave: () => void
  onCancel: () => void
}

function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number)
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
}

export default function DayCard({
  day,
  isExpanded,
  isEditing,
  draft,
  saving,
  saveError,
  onToggleExpand,
  onStartEdit,
  onDraftChange,
  onSave,
  onCancel,
}: DayCardProps) {
  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
      <button
        onClick={onToggleExpand}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
      >
        <span className="text-xs text-slate-400 w-24 shrink-0">
          {formatDate(day.date)}
        </span>
        <span className="flex-1 text-sm font-medium text-slate-800">
          {day.title}
        </span>
        {day.is_special && day.special_label && (
          <span className="text-xs font-medium text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full shrink-0">
            {day.special_label}
          </span>
        )}
        <IntensityBadge intensity={day.intensity} />
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-slate-400 shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
        )}
      </button>

      {isExpanded && !isEditing && (
        <div className="px-4 pt-2 pb-4 border-t border-slate-100">
          <p className="text-sm text-slate-600 leading-relaxed">{day.plan}</p>
          <div className="mt-3">
            <Button variant="outline" size="sm" onClick={onStartEdit}>
              Edit
            </Button>
          </div>
        </div>
      )}

      {isExpanded && isEditing && draft && (
        <div className="border-t border-slate-100">
          <DayEditor
            title={draft.title}
            plan={draft.plan}
            intensity={draft.intensity}
            saving={saving}
            saveError={saveError}
            onChange={onDraftChange}
            onSave={onSave}
            onCancel={onCancel}
          />
        </div>
      )}
    </div>
  )
}
