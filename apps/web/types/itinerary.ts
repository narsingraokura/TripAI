export type ConstraintStatus = "ok" | "warning" | "violation"
export type ConstraintType =
  | "budget"
  | "dates"
  | "pace"
  | "dietary"
  | "accessibility"
  | "preference"
export type ActivityCategory =
  | "food"
  | "sightseeing"
  | "transport"
  | "accommodation"
  | "outdoor"
  | "culture"
  | "shopping"
  | "misc"
export type DayType = "travel" | "leisure" | "sightseeing" | "rest" | "special"

export interface Goal {
  id: string
  label: string
  isPreset: boolean
}

export interface Constraint {
  id: string
  type: ConstraintType
  description: string
  value?: string
  status: ConstraintStatus
}

export interface Activity {
  id: string
  name: string
  category: ActivityCategory
  cost: number
  durationMinutes: number
}

export interface Day {
  id: string
  date: string
  city: string
  country: string
  dayType: DayType
  activities: Activity[]
  notes?: string
}

export interface Itinerary {
  id: string
  name: string
  goals: Goal[]
  constraints: Constraint[]
  days: Day[]
}

export interface ValidationResult {
  level: "ok" | "warning" | "violation"
  message: string
  field?: string
}

export interface Resolution {
  label: string
  description: string
}

export const PRESET_GOALS: readonly string[] = [
  "Cultural experiences",
  "Family-friendly activities",
  "Budget-conscious travel",
  "Local cuisine focus",
  "Outdoor adventures",
  "Minimal travel days",
  "Museum & art tours",
  "Relaxed pace",
]

export const CATEGORY_ICONS: Record<ActivityCategory, string> = {
  food: "Utensils",
  sightseeing: "Camera",
  transport: "Train",
  accommodation: "BedDouble",
  outdoor: "Mountain",
  culture: "Landmark",
  shopping: "ShoppingBag",
  misc: "Star",
}

export const DAY_TYPE_COLORS: Record<DayType, string> = {
  travel: "bg-slate-100 text-slate-600",
  leisure: "bg-green-100 text-green-800",
  sightseeing: "bg-blue-100 text-blue-800",
  rest: "bg-purple-100 text-purple-800",
  special: "bg-amber-100 text-amber-800",
}
