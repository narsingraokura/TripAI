"use client"

import { useIsDemo } from "@/components/DemoModeProvider"

export function DemoBanner() {
  const isDemo = useIsDemo()
  if (!isDemo) return null

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-center text-sm text-amber-800">
      Demo mode — view only
    </div>
  )
}
