"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { ReactElement } from "react"

type Tab = {
  label: string
  href: string | null
  Icon: () => ReactElement
}

function HomeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
      <line x1="16" x2="16" y1="2" y2="6"/>
      <line x1="8" x2="8" y1="2" y2="6"/>
      <line x1="3" x2="21" y1="10" y2="10"/>
    </svg>
  )
}

function WalletIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/>
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/>
      <path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>
    </svg>
  )
}

function MessageIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"/>
    </svg>
  )
}

const tabs: Tab[] = [
  { label: "Home",      href: "/trip",        Icon: HomeIcon },
  { label: "Itinerary", href: "/itinerary",  Icon: CalendarIcon },
  { label: "Budget",    href: null,           Icon: WalletIcon },
  { label: "Chat",      href: "/chat",        Icon: MessageIcon },
]

function matchesPath(href: string, pathname: string) {
  return pathname.startsWith(href)
}

export default function Navigation() {
  const pathname = usePathname()

  return (
    <>
      {/* Desktop: sticky top nav */}
      <nav className="hidden md:flex items-center justify-between px-6 h-14 bg-white border-b border-slate-200 sticky top-0 z-50">
        <span className="text-sm font-semibold text-slate-900 tracking-tight font-mono">TripAI</span>
        <div className="flex items-center gap-1">
          {tabs.map(({ label, href, Icon }) => {
            const active = href !== null && matchesPath(href, pathname)
            if (href !== null) {
              return (
                <Link
                  key={label}
                  href={href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    active
                      ? "bg-slate-100 text-slate-900 font-semibold"
                      : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <Icon />
                  {label}
                </Link>
              )
            }
            return (
              <span
                key={label}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-slate-300 cursor-not-allowed select-none"
                title={`${label} — coming soon`}
              >
                <Icon />
                {label}
                <span className="text-xs bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded-full leading-none">
                  soon
                </span>
              </span>
            )
          })}
        </div>
      </nav>

      {/* Mobile: fixed bottom tab bar */}
      <nav className="flex md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200">
        {tabs.map(({ label, href, Icon }) => {
          const active = href !== null && matchesPath(href, pathname)
          const base = "flex flex-col items-center justify-center flex-1 gap-0.5 py-2 text-xs transition-colors"

          if (href !== null) {
            return (
              <Link
                key={label}
                href={href}
                className={`${base} ${
                  active ? "text-slate-900 font-semibold" : "text-slate-400 hover:text-slate-600"
                }`}
              >
                <Icon />
                {label}
              </Link>
            )
          }
          return (
            <span
              key={label}
              className={`${base} text-slate-300 cursor-not-allowed select-none`}
            >
              <Icon />
              {label}
              <span className="text-[10px] text-slate-300 leading-none -mt-0.5">soon</span>
            </span>
          )
        })}
      </nav>
    </>
  )
}
