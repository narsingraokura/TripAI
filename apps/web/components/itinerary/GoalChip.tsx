"use client"

import { X } from "lucide-react"
import { cn } from "@/lib/utils"

type GoalChipProps = {
  label: string
  selected?: boolean
  isCustom?: boolean
  onRemove?: () => void
  onClick?: () => void
}

export default function GoalChip({
  label,
  selected = false,
  isCustom = false,
  onRemove,
  onClick,
}: GoalChipProps) {
  return (
    <span
      role={onClick ? "button" : undefined}
      aria-label={onClick ? label : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") onClick()
            }
          : undefined
      }
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium transition-colors",
        selected
          ? "bg-slate-800 text-white"
          : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50",
        isCustom && !selected && "border-dashed",
        onClick && "cursor-pointer",
      )}
    >
      {label}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          aria-label={`Remove ${label}`}
          className="ml-0.5 rounded-full p-0.5 hover:bg-black/10"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  )
}
