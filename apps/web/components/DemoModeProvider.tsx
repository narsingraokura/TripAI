"use client"

import { createContext, useContext, type ReactNode } from "react"

const DemoModeContext = createContext<boolean>(false)

export function DemoModeProvider({ children }: { children: ReactNode }) {
  const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === "true"
  return (
    <DemoModeContext.Provider value={isDemo}>
      {children}
    </DemoModeContext.Provider>
  )
}

export function useIsDemo(): boolean {
  return useContext(DemoModeContext)
}
