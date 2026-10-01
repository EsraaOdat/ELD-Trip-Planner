import type { Place, TripPlan, TripRequest } from './types'

const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

const FIELD_NAMES: Record<string, string> = {
  current_location: 'Current location',
  pickup_location: 'Pickup location',
  dropoff_location: 'Dropoff location',
  current_cycle_used: 'Current cycle used',
  start_time: 'Start time',
}

/** Turns a Django REST Framework error body into one readable sentence. */
function errorMessage(body: unknown): string {
  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>
    if (typeof record.detail === 'string') return record.detail
    const [field, problem] = Object.entries(record)[0] ?? []
    if (field) {
      const text = Array.isArray(problem) ? problem[0] : Object.values(problem as object)[0]
      return `${FIELD_NAMES[field] ?? field}: ${Array.isArray(text) ? text[0] : text}`
    }
  }
  return 'error.unknown'
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, init)
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new Error('error.network') // a translation key
  }
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new Error(errorMessage(body))
  return body as T
}

export function searchPlaces(query: string, signal: AbortSignal) {
  return request<Required<Place>[]>(`/api/geocode/?q=${encodeURIComponent(query)}`, { signal })
}

export function planTrip(trip: TripRequest) {
  return request<TripPlan>('/api/trips/plan/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(trip),
  })
}
