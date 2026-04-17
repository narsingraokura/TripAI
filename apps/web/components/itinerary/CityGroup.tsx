import type { ItineraryDay, Intensity, Suggestion } from "@/lib/api"
import DayCard from "./DayCard"

type CityGroupProps = {
  city: string
  days: ItineraryDay[]
  expandedDate: string | null
  editingDate: string | null
  draft: { title: string; plan: string; intensity: Intensity } | null
  saving: boolean
  saveError: string | null
  suggestingDate: string | null
  suggestLoading: boolean
  suggestions: Suggestion[] | null
  suggestError: string | null
  onToggleExpand: (date: string) => void
  onStartEdit: (date: string) => void
  onDraftChange: (field: "title" | "plan" | "intensity", value: string) => void
  onSave: () => void
  onCancel: () => void
  onSuggest: (date: string) => void
  onSelectSuggestion: (s: Suggestion) => void
  onDelete: (date: string) => void
}

export default function CityGroup({
  city,
  days,
  expandedDate,
  editingDate,
  draft,
  saving,
  saveError,
  suggestingDate,
  suggestLoading,
  suggestions,
  suggestError,
  onToggleExpand,
  onStartEdit,
  onDraftChange,
  onSave,
  onCancel,
  onSuggest,
  onSelectSuggestion,
  onDelete,
}: CityGroupProps) {
  return (
    <section>
      <h2 className="text-base font-semibold text-slate-900 mb-3 flex items-center gap-2">
        {city}
        <span className="text-xs font-normal text-slate-400">
          {days.length} {days.length === 1 ? "day" : "days"}
        </span>
      </h2>
      <div className="space-y-2">
        {days.map((day) => (
          <DayCard
            key={day.date}
            day={day}
            isExpanded={expandedDate === day.date}
            isEditing={editingDate === day.date}
            draft={editingDate === day.date ? draft : null}
            saving={saving}
            saveError={editingDate === day.date ? saveError : null}
            suggestLoading={suggestingDate === day.date && suggestLoading}
            suggestions={suggestingDate === day.date ? suggestions : null}
            suggestError={suggestingDate === day.date ? suggestError : null}
            onToggleExpand={() => onToggleExpand(day.date)}
            onStartEdit={() => onStartEdit(day.date)}
            onDraftChange={onDraftChange}
            onSave={onSave}
            onCancel={onCancel}
            onSuggest={() => onSuggest(day.date)}
            onSelectSuggestion={onSelectSuggestion}
            onDelete={() => onDelete(day.date)}
          />
        ))}
      </div>
    </section>
  )
}
