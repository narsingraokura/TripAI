"use client"

import {
  BedDouble,
  Camera,
  ChevronDown,
  ChevronUp,
  Landmark,
  Mountain,
  ShoppingBag,
  Star,
  Train,
  Utensils,
} from "lucide-react"
import type { ActivityCategory, Day } from "@/types/itinerary"
import { DAY_TYPE_COLORS } from "@/types/itinerary"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

type IconComponent = React.ComponentType<{ className?: string }>

const ICON_MAP: Record<ActivityCategory, IconComponent> = {
  food: Utensils,
  sightseeing: Camera,
  transport: Train,
  accommodation: BedDouble,
  outdoor: Mountain,
  culture: Landmark,
  shopping: ShoppingBag,
  misc: Star,
}

function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number)
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
}

type ItineraryDayCardProps = {
  day: Day
  dayNumber: number
  isExpanded: boolean
  onToggleExpand: () => void
  onEdit?: () => void
  onRemove?: () => void
}

export default function ItineraryDayCard({
  day,
  dayNumber,
  isExpanded,
  onToggleExpand,
  onEdit,
  onRemove,
}: ItineraryDayCardProps) {
  const totalCost = day.activities.reduce((sum, a) => sum + a.cost, 0)
  const activityLabel =
    day.activities.length === 1 ? "1 activity" : `${day.activities.length} activities`

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
      {/* Collapsed header */}
      <button
        onClick={onToggleExpand}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
      >
        <span className="text-xs font-semibold text-slate-500 w-12 shrink-0">
          Day {dayNumber}
        </span>
        <span className="text-xs text-slate-400 w-16 shrink-0">{formatDate(day.date)}</span>
        <span className="flex-1 text-sm font-medium text-slate-800">{day.city}</span>
        <span className="text-xs text-slate-400 shrink-0">{activityLabel}</span>
        <span
          className={cn(
            "text-xs font-medium shrink-0 rounded-full px-2 py-0.5",
            DAY_TYPE_COLORS[day.dayType],
          )}
        >
          ${totalCost}
        </span>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-slate-400 shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
        )}
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-slate-100">
          {day.activities.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-sm text-slate-400">No activities planned yet</p>
              <p className="text-xs text-slate-400 mt-1">
                Add activities to build this day&apos;s plan
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {day.activities.map((activity) => {
                const Icon = ICON_MAP[activity.category]
                return (
                  <li key={activity.id} className="flex items-center gap-3 px-4 py-2.5">
                    <Icon className="h-4 w-4 text-slate-400 shrink-0" />
                    <span className="flex-1 text-sm text-slate-800">{activity.name}</span>
                    <span className="text-xs text-slate-400 shrink-0">
                      {activity.durationMinutes} min
                    </span>
                    <span className="text-xs font-medium text-slate-600 shrink-0">
                      ${activity.cost}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}

          {/* Edit / Remove actions — only rendered when handlers are provided */}
          {(onEdit ?? onRemove) && (
            <div className="px-4 py-2 border-t border-slate-100 flex items-center gap-2">
              {onEdit && (
                <Button variant="outline" size="sm" onClick={onEdit}>
                  Edit
                </Button>
              )}
              <div className="flex-1" />
              {onRemove && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onRemove}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                >
                  Remove
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
