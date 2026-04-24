export type Urgency = "fire" | "now" | "soon"
export type BookingStatus = "pending" | "booked"

export type Booking = {
  id: string
  title: string
  subtitle: string
  category: string
  urgency: Urgency
  status: BookingStatus
  estimated_cost: number
  actual_cost: number | null
  deadline: string
  discount_code: string | null
  card_tip: string
  booked_at: string | null
}

export type BookingSummary = {
  total_estimated: number
  total_actual: number
  locked_in: number
  remaining: number
  booked_count: number
  total_count: number
}

export type BookingsResponse = {
  bookings: Booking[]
  summary: BookingSummary
}

function getApiBase(): string {
  const url = process.env.NEXT_PUBLIC_API_URL
  if (!url) throw new Error("NEXT_PUBLIC_API_URL is not set")
  return url
}

function getTripId(): string {
  const id = process.env.NEXT_PUBLIC_TRIP_ID
  if (!id) throw new Error("NEXT_PUBLIC_TRIP_ID is not set")
  return id
}

function getAdminApiKey(): string {
  const key = process.env.NEXT_PUBLIC_ADMIN_API_KEY
  if (!key) throw new Error("NEXT_PUBLIC_ADMIN_API_KEY is not set")
  return key
}

export async function fetchBookings(): Promise<BookingsResponse> {
  const res = await fetch(`${getApiBase()}/trips/${getTripId()}/bookings`)
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json() as Promise<BookingsResponse>
}

export async function patchBookingStatus(
  bookingId: string,
  status: BookingStatus,
): Promise<Booking> {
  const res = await fetch(
    `${getApiBase()}/trips/${getTripId()}/bookings/${bookingId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "X-API-Key": getAdminApiKey() },
      body: JSON.stringify({ status }),
    },
  )
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json() as Promise<Booking>
}

export type Intensity = "light" | "moderate" | "busy" | "travel" | "special"

export type ItineraryDay = {
  id: string
  trip_id: string
  date: string
  city: string | null
  country: string | null
  title: string
  plan: string
  intensity: Intensity
  is_special: boolean
  special_label: string | null
}

export type ItineraryDayPatch = {
  title?: string
  plan?: string
  intensity?: Intensity
}

type ItineraryApiResponse = { days: ItineraryDay[] }

export async function fetchItinerary(): Promise<ItineraryDay[]> {
  const res = await fetch(`${getApiBase()}/trips/${getTripId()}/itinerary`)
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  const data = (await res.json()) as ItineraryApiResponse
  return data.days
}

export async function patchItineraryDay(
  date: string,
  patch: ItineraryDayPatch,
): Promise<ItineraryDay | null> {
  const res = await fetch(
    `${getApiBase()}/trips/${getTripId()}/itinerary/${date}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "X-API-Key": getAdminApiKey() },
      body: JSON.stringify(patch),
    },
  )
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  if (res.status === 204) return null
  return res.json() as Promise<ItineraryDay>
}

export type ItineraryDayCreate = {
  date: string
  city: string
  country: string
  title: string
  plan?: string
  intensity?: Intensity
}

export async function createItineraryDay(data: ItineraryDayCreate): Promise<ItineraryDay> {
  const res = await fetch(`${getApiBase()}/trips/${getTripId()}/itinerary`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": getAdminApiKey() },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json() as Promise<ItineraryDay>
}

export async function deleteItineraryDay(date: string): Promise<void> {
  const res = await fetch(
    `${getApiBase()}/trips/${getTripId()}/itinerary/${date}`,
    { method: "DELETE", headers: { "X-API-Key": getAdminApiKey() } },
  )
  if (!res.ok) throw new Error(`API error: ${res.status}`)
}

export type ChatMessage = {
  role: "user" | "assistant"
  content: string
}

export type ChatSource = {
  label: string
  date: string
}

export type SSEChunk =
  | { type: "token"; content: string }
  | { type: "sources"; sources: ChatSource[] }
  | { type: "error"; message: string }
  | { type: "done" }

export async function* streamChat(
  message: string,
  history: ChatMessage[],
): AsyncGenerator<SSEChunk> {
  const res = await fetch(`${getApiBase()}/trips/${getTripId()}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: message }),
  })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  if (!res.body) throw new Error("No response body")

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop() ?? ""
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6).trim()
        if (!data || data === "[DONE]") continue
        yield JSON.parse(data) as SSEChunk
      }
    }
  }

  if (buffer.startsWith("data: ")) {
    const data = buffer.slice(6).trim()
    if (data && data !== "[DONE]") yield JSON.parse(data) as SSEChunk
  }
}

export type Suggestion = {
  title: string
  description: string
  why_fits: string
  cost_delta: number
  intensity: "light" | "moderate" | "busy"
  booking_required: boolean
}

// ── Phase-2 itinerary types (new /api/ prefix backend) ────────────────────────

export type ApiGoal = {
  id: string
  trip_id: string
  goal_type: "preset" | "custom"
  label: string
  created_at: string
}

export type ApiConstraintType =
  | "must_visit"
  | "must_avoid"
  | "budget_cap"
  | "time_constraint"
  | "custom"

export type ApiConstraint = {
  id: string
  trip_id: string
  constraint_type: ApiConstraintType
  description: string
  value: number | null
  created_at: string
}

export type ApiActivityCategory =
  | "food"
  | "transit"
  | "sightseeing"
  | "lodging"
  | "shopping"
  | "activity"

export type ApiActivity = {
  id: string
  day_id: string
  position: number
  title: string
  time_slot: "morning" | "afternoon" | "evening" | "specific"
  specific_time: string | null
  category: ApiActivityCategory
  estimated_cost: number | null
  notes: string | null
  created_at: string
}

export type ApiDayType = "exploration" | "rest" | "transit"

export type ApiDay = {
  id: string
  trip_id: string
  position: number
  date: string | null
  city: string | null
  day_type: ApiDayType
  notes: string | null
  created_at: string
  updated_at: string
  activities: ApiActivity[]
}

export type ApiItinerary = {
  days: ApiDay[]
  goals: ApiGoal[]
  constraints: ApiConstraint[]
}

export async function fetchItineraryFull(): Promise<ApiItinerary> {
  const res = await fetch(`${getApiBase()}/api/trips/${getTripId()}/itinerary`)
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json() as Promise<ApiItinerary>
}

export async function putTripGoals(
  goals: Array<{ goal_type: "preset" | "custom"; label: string }>,
): Promise<ApiGoal[]> {
  const res = await fetch(`${getApiBase()}/api/trips/${getTripId()}/goals`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "X-API-Key": getAdminApiKey() },
    body: JSON.stringify({ goals }),
  })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json() as Promise<ApiGoal[]>
}

export async function postTripConstraint(body: {
  constraint_type: ApiConstraintType
  description: string
  value?: number
}): Promise<ApiConstraint> {
  const res = await fetch(`${getApiBase()}/api/trips/${getTripId()}/constraints`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": getAdminApiKey() },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json() as Promise<ApiConstraint>
}

export async function deleteTripConstraint(constraintId: string): Promise<void> {
  const res = await fetch(
    `${getApiBase()}/api/trips/${getTripId()}/constraints/${constraintId}`,
    { method: "DELETE", headers: { "X-API-Key": getAdminApiKey() } },
  )
  if (!res.ok) throw new Error(`API error: ${res.status}`)
}

type SuggestApiResponse = {
  date: string
  city: string
  suggestions: Suggestion[]
}

export async function fetchSuggestions(date: string): Promise<Suggestion[]> {
  const res = await fetch(
    `${getApiBase()}/trips/${getTripId()}/itinerary/${date}/suggest`,
    { method: "POST", headers: { "X-API-Key": getAdminApiKey() } },
  )
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { detail?: string } | null
    throw new Error(body?.detail ?? `API error: ${res.status}`)
  }
  const data = (await res.json()) as SuggestApiResponse
  return data.suggestions
}
