import type { DutyStatus, EventKind } from './types'

export const STATUS_LABEL: Record<DutyStatus, string> = {
  off_duty: 'Off duty',
  sleeper: 'Sleeper berth',
  driving: 'Driving',
  on_duty: 'On duty (not driving)',
}

/** Colour and map-marker letter for each kind of stop. */
export const KIND_STYLE: Record<EventKind | 'start', { color: string; glyph: string }> = {
  start: { color: '#0b1f3a', glyph: 'S' },
  pickup: { color: '#1d4ed8', glyph: 'P' },
  dropoff: { color: '#059669', glyph: 'D' },
  fuel: { color: '#d97706', glyph: 'F' },
  break: { color: '#64748b', glyph: 'B' },
  rest: { color: '#7c3aed', glyph: 'R' },
  restart: { color: '#be123c', glyph: '34' },
  pretrip: { color: '#d97706', glyph: '' },
  drive: { color: '#059669', glyph: '' },
  pre: { color: '#64748b', glyph: '' },
  post: { color: '#64748b', glyph: '' },
}

/** 135 -> "2h 15m" */
export function duration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (!hours) return `${rest}m`
  return rest ? `${hours}h ${rest}m` : `${hours}h`
}

/** Minutes as decimal hours the way a paper log totals them: 465 -> "7.75" */
export function decimalHours(minutes: number): string {
  return String(Math.round((minutes / 60) * 100) / 100)
}

/** "2026-10-02T14:15" -> "2:15 PM" */
export function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

/** "2026-10-02" or a full ISO time -> "Fri, Oct 2" */
export function dayLabel(iso: string): string {
  const date = new Date(iso.length === 10 ? `${iso}T00:00` : iso)
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export function miles(value: number): string {
  return `${value.toLocaleString('en-US')} mi`
}

/** The next quarter hour from now, formatted for <input type="datetime-local">. */
export function nextQuarterHour(): string {
  const now = new Date()
  now.setMinutes(Math.ceil(now.getMinutes() / 15) * 15, 0, 0)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`
}
