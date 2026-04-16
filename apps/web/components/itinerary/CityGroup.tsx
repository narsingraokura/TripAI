import type { ItineraryDay, Intensity } from "@/lib/api"
import DayCard from "./DayCard"

type CityGroupProps = {
  city: string
  days: ItineraryDay[]
  expandedDate: string | null
  editingDate: string | null
  draft: { title: string; plan: string; intensity: Intensity } | null
  saving: boolean
  saveError: string | null
  onToggleExpand: (date: string) => void
  onStartEdit: (date: string) => void
  onDraftChange: (field: "title" | "plan" | "intensity", value: string) => void
  onSave: () => void
  onCancel: () => void
}

export default function CityGroup({
  city,
  days,
  expandedDate,
  editingDate,
  draft,
  saving,
  saveError,
  onToggleExpand,
  onStartEdit,
  onDraftChange,
  onSave,
  onCancel,
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
            onToggleExpand={() => onToggleExpand(day.date)}
            onStartEdit={() => onStartEdit(day.date)}
            onDraftChange={onDraftChange}
            onSave={onSave}
            onCancel={onCancel}
          />
        ))}
      </div>
    </section>
  )
}
