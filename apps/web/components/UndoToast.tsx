"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"

const DEFAULT_DURATION_MS = 10_000

type UndoToastProps = {
  message: string
  onUndo: () => void
  onExpire: () => void
  durationMs?: number
}

export default function UndoToast({
  message,
  onUndo,
  onExpire,
  durationMs = DEFAULT_DURATION_MS,
}: UndoToastProps) {
  const [expired, setExpired] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setExpired(true)
      onExpire()
    }, durationMs)
    return () => clearTimeout(timer)
  }, [durationMs, onExpire])

  if (expired) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-lg bg-slate-800 px-4 py-3 shadow-lg text-white text-sm"
    >
      <span>{message}</span>
      <Button
        size="sm"
        variant="ghost"
        onClick={onUndo}
        className="text-white hover:text-white hover:bg-white/10 h-auto py-0.5 px-2 font-medium"
      >
        Undo
      </Button>
    </div>
  )
}
