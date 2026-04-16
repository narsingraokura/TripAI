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
      headers: { "Content-Type": "application/json" },
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

export async function fetchItinerary(): Promise<ItineraryDay[]> {
  const res = await fetch(`${getApiBase()}/trips/${getTripId()}/itinerary`)
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json() as Promise<ItineraryDay[]>
}

export async function patchItineraryDay(
  date: string,
  patch: ItineraryDayPatch,
): Promise<ItineraryDay | null> {
  const res = await fetch(
    `${getApiBase()}/trips/${getTripId()}/itinerary/${date}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    },
  )
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  if (res.status === 204) return null
  return res.json() as Promise<ItineraryDay>
}
