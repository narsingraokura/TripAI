"use client"

import { usePathname } from "next/navigation"
import Navigation from "@/components/Navigation"

export default function ConditionalNav() {
  const pathname = usePathname()
  if (pathname === "/") return null
  return <Navigation />
}
