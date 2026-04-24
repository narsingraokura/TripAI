"use client"

import { useState } from "react"
import {
  Accessibility,
  Calendar,
  DollarSign,
  Gauge,
  Heart,
  Trash2,
  Utensils,
} from "lucide-react"
import type { Constraint, ConstraintStatus, ConstraintType } from "@/types/itinerary"
import { cn } from "@/lib/utils"

const STATUS_BORDER: Record<ConstraintStatus, string> = {
  ok: "border-l-green-500",
  warning: "border-l-amber-500",
  violation: "border-l-red-500",
}

type IconComponent = React.ComponentType<{ className?: string }>

const TYPE_ICONS: Record<ConstraintType, IconComponent> = {
  budget: DollarSign,
  dates: Calendar,
  pace: Gauge,
  dietary: Utensils,
  accessibility: Accessibility,
  preference: Heart,
}

type ConstraintBadgeProps = {
  constraint: Constraint
  onDelete: (id: string) => void
}

export default function ConstraintBadge({ constraint, onDelete }: ConstraintBadgeProps) {
  const [confirming, setConfirming] = useState(false)
  const Icon = TYPE_ICONS[constraint.type]

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-md border border-slate-200 border-l-4 bg-white p-3",
        STATUS_BORDER[constraint.status],
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-800">{constraint.description}</p>
        {constraint.value && (
          <p className="text-xs text-slate-500 mt-0.5">{constraint.value}</p>
        )}
      </div>
      {confirming ? (
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => {
              setConfirming(false)
              onDelete(constraint.id)
            }}
            className="text-xs font-medium text-red-600 hover:text-red-800"
          >
            Delete
          </button>
          <span className="text-xs text-slate-400">·</span>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="text-xs text-slate-500 hover:text-slate-700"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          aria-label="Delete constraint"
          className="shrink-0 rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
