"use client"

import { AlertTriangle } from "lucide-react"
import type { Day } from "@/types/itinerary"
import { Button } from "@/components/ui/button"

type RemoveDayDialogProps = {
  day: Day
  mustVisitActivity: string | null
  onConfirm: () => void
  onCancel: () => void
}

export default function RemoveDayDialog({
  day,
  mustVisitActivity,
  onConfirm,
  onCancel,
}: RemoveDayDialogProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
    >
      <div className="bg-white rounded-xl shadow-xl max-w-sm w-full mx-4 p-6 space-y-4">
        <h2 className="text-base font-semibold text-slate-900">
          Remove {day.city} from your itinerary?
        </h2>

        {mustVisitActivity && (
          <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">
              This day includes{" "}
              <span className="font-medium">{mustVisitActivity}</span>, which is
              a non-negotiable. Removing it will violate your constraints.
            </p>
          </div>
        )}

        <p className="text-sm text-slate-500">This action can be undone within 10 seconds.</p>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
          >
            Remove
          </Button>
        </div>
      </div>
    </div>
  )
}
