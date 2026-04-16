import { cn } from "@/lib/utils"
import type { Intensity } from "@/lib/api"

const COLOR: Record<Intensity, string> = {
  light: "bg-green-100 text-green-800",
  moderate: "bg-blue-100 text-blue-800",
  busy: "bg-amber-100 text-amber-800",
  travel: "bg-slate-100 text-slate-600",
  special: "bg-purple-100 text-purple-800",
}

export default function IntensityBadge({ intensity }: { intensity: Intensity }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        COLOR[intensity],
      )}
    >
      {intensity}
    </span>
  )
}
