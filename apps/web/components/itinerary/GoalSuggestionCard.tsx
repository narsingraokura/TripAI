"use client"

import { useEffect, useState } from "react"
import { AlertCircle, AlertTriangle, CheckCircle } from "lucide-react"
import type { Resolution } from "@/types/itinerary"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const AUTO_DISMISS_MS = 3000

type GoalSuggestionCardProps = {
  status: "ok" | "warning" | "violation"
  message: string
  field?: string
  resolutions?: Resolution[]
  onApply?: (resolution: Resolution) => void
  onDismiss?: () => void
}

const STYLES = {
  ok: {
    wrapper: "bg-green-50 border-green-200",
    icon: "text-green-600",
    message: "text-green-800",
    Icon: CheckCircle,
  },
  warning: {
    wrapper: "bg-amber-50 border-amber-200",
    icon: "text-amber-600",
    message: "text-amber-800",
    Icon: AlertTriangle,
  },
  violation: {
    wrapper: "bg-red-50 border-red-200",
    icon: "text-red-600",
    message: "text-red-800",
    Icon: AlertCircle,
  },
}

export default function GoalSuggestionCard({
  status,
  message,
  field,
  resolutions,
  onApply,
  onDismiss,
}: GoalSuggestionCardProps) {
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (status !== "ok") return
    const timer = setTimeout(() => {
      setDismissed(true)
      onDismiss?.()
    }, AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [status, onDismiss])

  if (dismissed) return null

  const { wrapper, icon, message: msgClass, Icon } = STYLES[status]

  return (
    <div className={cn("rounded-lg border p-4 space-y-3", wrapper)}>
      <div className="flex items-start gap-2">
        <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", icon)} />
        <div className="flex-1 min-w-0">
          <p className={cn("text-sm font-medium", msgClass)}>{message}</p>
          {field && (
            <p className={cn("text-xs mt-0.5 opacity-75", msgClass)}>{field}</p>
          )}
        </div>
      </div>

      {resolutions && resolutions.length > 0 && (
        <div className="space-y-2 pl-6">
          {resolutions.map((resolution, i) => (
            <div
              key={i}
              className="flex items-start justify-between gap-3 rounded-md border border-red-200 bg-white p-3"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800">{resolution.label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{resolution.description}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                aria-label={`Apply: ${resolution.label}`}
                onClick={() => onApply?.(resolution)}
                className="shrink-0"
              >
                Apply
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
