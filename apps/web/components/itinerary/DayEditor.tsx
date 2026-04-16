import type { Intensity } from "@/lib/api"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

const INTENSITIES: Intensity[] = ["light", "moderate", "busy", "travel", "special"]

type DayEditorProps = {
  title: string
  plan: string
  intensity: Intensity
  saving: boolean
  saveError: string | null
  onChange: (field: "title" | "plan" | "intensity", value: string) => void
  onSave: () => void
  onCancel: () => void
}

export default function DayEditor({
  title,
  plan,
  intensity,
  saving,
  saveError,
  onChange,
  onSave,
  onCancel,
}: DayEditorProps) {
  return (
    <div className="p-4 space-y-3">
      <div>
        <label className="block text-xs text-slate-500 mb-1">Title</label>
        <Input
          value={title}
          onChange={(e) => onChange("title", e.target.value)}
          disabled={saving}
        />
      </div>
      <div>
        <label className="block text-xs text-slate-500 mb-1">Plan</label>
        <textarea
          value={plan}
          onChange={(e) => onChange("plan", e.target.value)}
          disabled={saving}
          rows={4}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
        />
      </div>
      <div>
        <label className="block text-xs text-slate-500 mb-1">Intensity</label>
        <select
          value={intensity}
          onChange={(e) => onChange("intensity", e.target.value)}
          disabled={saving}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {INTENSITIES.map((i) => (
            <option key={i} value={i}>
              {i}
            </option>
          ))}
        </select>
      </div>
      {saveError && (
        <p className="text-xs text-red-600">{saveError}</p>
      )}
      <div className="flex gap-2 pt-1">
        <Button size="sm" onClick={onSave} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
