export type DutyStatus = 'off_duty' | 'sleeper' | 'driving' | 'on_duty'

export type EventKind =
  | 'pre'
  | 'post'
  | 'pretrip'
  | 'drive'
  | 'pickup'
  | 'dropoff'
  | 'fuel'
  | 'break'
  | 'rest'
  | 'restart'

export interface Place {
  label: string
  lat?: number
  lng?: number
}

export interface TripRequest {
  current_location: Place
  pickup_location: Place
  dropoff_location: Place
  current_cycle_used: number
  start_time: string
}

/** One entry of the trip schedule. Times are home-terminal local ISO strings. */
export interface TripEvent {
  status: DutyStatus
  kind: EventKind
  note: string
  location: string
  lat: number
  lng: number
  start: string
  end: string
  minutes: number
  miles: number
  mile_marker: number
}

/** One line piece on a day's log grid. start/end are minutes since midnight. */
export interface LogSegment {
  status: DutyStatus
  kind: EventKind
  note: string
  location: string
  start: number
  end: number
  continued: boolean
}

export interface LogDay {
  index: number
  date: string
  segments: LogSegment[]
  totals: Record<DutyStatus, number>
  miles: number
  from: string
  to: string
  on_duty_today: number
  cycle_used: number
  cycle_available: number
}

export interface Leg {
  name: string
  miles: number
  driving_minutes: number
  path: [number, number][]
  directions: { road: string; miles: number }[]
}

export interface TripPlan {
  locations: Record<'current' | 'pickup' | 'dropoff', Required<Place>>
  legs: Leg[]
  summary: {
    total_miles: number
    driving_minutes: number
    on_duty_minutes: number
    trip_minutes: number
    departure: string
    arrival: string
    days: number
    stops: Record<'fuel' | 'break' | 'rest' | 'restart', number>
    cycle_used_start: number
    cycle_used_end: number
  }
  stops: TripEvent[]
  timeline: TripEvent[]
  days: LogDay[]
}

/** Optional details printed on the log sheet header. */
export interface SheetDetails {
  driver: string
  carrier: string
  office: string
  vehicle: string
  shipment: string
}
