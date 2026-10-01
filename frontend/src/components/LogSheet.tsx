import { decimalHours } from '../format'
import type { DutyStatus, EventKind, LogDay, SheetDetails } from '../types'

// Geometry of the sheet, in SVG units.
const WIDTH = 1100
const HEIGHT = 800
const GRID_LEFT = 150
const HOUR_WIDTH = 34
const GRID_RIGHT = GRID_LEFT + 24 * HOUR_WIDTH
const BAND_TOP = 250
const GRID_TOP = 276
const ROW_HEIGHT = 36
const GRID_BOTTOM = GRID_TOP + 4 * ROW_HEIGHT

const ROWS: { status: DutyStatus; label: string[] }[] = [
  { status: 'off_duty', label: ['1. Off Duty'] },
  { status: 'sleeper', label: ['2. Sleeper', 'Berth'] },
  { status: 'driving', label: ['3. Driving'] },
  { status: 'on_duty', label: ['4. On Duty', '(not driving)'] },
]

const HOUR_LABELS = ['Mid-', ...Array.from({ length: 11 }, (_, i) => String(i + 1)), 'Noon', ...Array.from({ length: 11 }, (_, i) => String(i + 1)), 'Mid-']

const SHORT_NOTE: Partial<Record<EventKind, string>> = {
  pretrip: 'Pre-trip',
  pickup: 'Pickup',
  dropoff: 'Drop-off',
  fuel: 'Fuel',
  break: 'Break',
  rest: 'Rest',
  restart: '34-hr restart',
}

const INK = '#111827'
const PEN = '#1d4ed8'

const x = (minute: number) => GRID_LEFT + (minute / 60) * HOUR_WIDTH
const rowY = (status: DutyStatus) => GRID_TOP + ROWS.findIndex((row) => row.status === status) * ROW_HEIGHT + ROW_HEIGHT / 2

/** The driver's line: horizontal while in a status, vertical at each change. */
function dutyPath(day: LogDay): string {
  return day.segments
    .map((segment, index) => {
      const y = rowY(segment.status)
      return `${index ? 'L' : 'M'}${x(segment.start)},${y} L${x(segment.end)},${y}`
    })
    .join(' ')
}

interface Stop {
  start: number
  end: number
  location: string
  notes: string[]
}

/** Periods when the truck stood still: each gets a bracket and a location remark. */
function stationaryStops(day: LogDay): Stop[] {
  const stops: Stop[] = []
  let current: Stop | null = null
  for (const segment of day.segments) {
    if (segment.status === 'driving') {
      current = null
      continue
    }
    const note = SHORT_NOTE[segment.kind]
    if (!note) continue // off duty before the trip starts or after it ends
    if (!current) {
      current = { start: segment.start, end: segment.end, location: segment.location, notes: [] }
      stops.push(current)
    }
    current.end = segment.end
    if (!current.notes.includes(note)) current.notes.push(note)
  }
  return stops
}

function Field({ x1, x2, y, value, caption, size = 15 }: { x1: number; x2: number; y: number; value: string; caption: string; size?: number }) {
  return (
    <g>
      <text x={(x1 + x2) / 2} y={y - 6} textAnchor="middle" className="sheet-value" fontSize={size}>
        {value}
      </text>
      <line x1={x1} x2={x2} y1={y} y2={y} stroke={INK} strokeWidth={1} />
      <text x={(x1 + x2) / 2} y={y + 13} textAnchor="middle" fontSize={10}>
        {caption}
      </text>
    </g>
  )
}

export default function LogSheet({ day, details }: { day: LogDay; details: SheetDetails }) {
  const [year, month, dayOfMonth] = day.date.split('-')
  const stops = stationaryStops(day)
  const tookRestart = day.segments.some((segment) => segment.kind === 'restart')
  let lastLabelX = -Infinity

  return (
    <svg className="log-sheet" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={`Driver's daily log for ${day.date}`} fill={INK}>
      <rect width={WIDTH} height={HEIGHT} fill="#fff" />

      {/* Header */}
      <text x={30} y={48} fontSize={28} fontWeight={700}>Drivers Daily Log</text>
      <text x={32} y={66} fontSize={11}>(24 hours)</text>
      <Field x1={330} x2={400} y={52} value={month} caption="(month)" size={17} />
      <text x={408} y={48} fontSize={18}>/</text>
      <Field x1={422} x2={492} y={52} value={dayOfMonth} caption="(day)" size={17} />
      <text x={500} y={48} fontSize={18}>/</text>
      <Field x1={514} x2={584} y={52} value={year} caption="(year)" size={17} />
      <text x={640} y={38} fontSize={11}><tspan fontWeight={700}>Original</tspan> – File at home terminal.</text>
      <text x={640} y={54} fontSize={11}><tspan fontWeight={700}>Duplicate</tspan> – Driver retains in his/her possession for 8 days.</text>

      <text x={30} y={104} fontSize={14} fontWeight={700}>From:</text>
      <text x={84} y={103} className="sheet-value" fontSize={15}>{day.from}</text>
      <line x1={80} x2={520} y1={108} y2={108} stroke={INK} />
      <text x={560} y={104} fontSize={14} fontWeight={700}>To:</text>
      <text x={596} y={103} className="sheet-value" fontSize={15}>{day.to}</text>
      <line x1={592} x2={1070} y1={108} y2={108} stroke={INK} />

      {[30, 190].map((left, index) => (
        <g key={left}>
          <rect x={left} y={128} width={150} height={38} fill="none" stroke={INK} />
          <text x={left + 75} y={154} textAnchor="middle" className="sheet-value" fontSize={17}>{day.miles}</text>
          <text x={left + 75} y={180} textAnchor="middle" fontSize={10}>{index ? 'Total Mileage Today' : 'Total Miles Driving Today'}</text>
        </g>
      ))}
      <Field x1={30} x2={340} y={214} value={details.vehicle} caption="Truck/Tractor and Trailer Numbers or License Plate(s)/State (show each unit)" />
      <Field x1={380} x2={1070} y={150} value={details.carrier} caption="Name of Carrier or Carriers" />
      <Field x1={380} x2={720} y={194} value={details.office} caption="Main Office Address" />
      <Field x1={740} x2={1070} y={194} value={details.driver} caption="Driver's Signature in Full" />

      {/* Hour band */}
      <rect x={30} y={BAND_TOP} width={WIDTH - 60} height={GRID_TOP - BAND_TOP} fill={INK} />
      {HOUR_LABELS.map((label, hour) => (
        <text key={hour} x={x(hour * 60)} y={BAND_TOP + (label === 'Mid-' ? 11 : 17)} textAnchor="middle" fontSize={10} fontWeight={600} fill="#fff">
          {label}
          {label === 'Mid-' && <tspan x={x(hour * 60)} dy={11}>night</tspan>}
        </text>
      ))}
      <text x={1030} y={BAND_TOP + 11} textAnchor="middle" fontSize={10} fontWeight={600} fill="#fff">
        Total<tspan x={1030} dy={11}>Hours</tspan>
      </text>

      {/* Grid rows, quarter-hour ticks and totals */}
      {ROWS.map((row, index) => {
        const top = GRID_TOP + index * ROW_HEIGHT
        return (
          <g key={row.status}>
            {row.label.map((line, lineIndex) => (
              <text key={line} x={32} y={top + (row.label.length === 1 ? 22 : 16 + lineIndex * 13)} fontSize={12} fontWeight={600}>
                {line}
              </text>
            ))}
            <rect x={GRID_LEFT} y={top} width={GRID_RIGHT - GRID_LEFT} height={ROW_HEIGHT} fill="none" stroke={INK} />
            {Array.from({ length: 96 }, (_, quarter) => {
              if (quarter % 4 === 0) return null
              const length = quarter % 2 === 0 ? 16 : 9
              return <line key={quarter} x1={x(quarter * 15)} x2={x(quarter * 15)} y1={top} y2={top + length} stroke={INK} strokeWidth={0.8} />
            })}
            <text x={1030} y={top + 24} textAnchor="middle" className="sheet-value" fontSize={17}>
              {decimalHours(day.totals[row.status])}
            </text>
            <line x1={990} x2={1070} y1={top + 30} y2={top + 30} stroke={INK} />
          </g>
        )
      })}
      {Array.from({ length: 25 }, (_, hour) => (
        <line key={hour} x1={x(hour * 60)} x2={x(hour * 60)} y1={GRID_TOP} y2={GRID_BOTTOM} stroke={INK} strokeWidth={hour % 12 === 0 ? 1.6 : 1} />
      ))}
      <text x={1030} y={GRID_BOTTOM + 26} textAnchor="middle" className="sheet-value" fontSize={17}>
        = {decimalHours(Object.values(day.totals).reduce((sum, minutes) => sum + minutes, 0))}
      </text>

      {/* The duty-status line */}
      <path d={dutyPath(day)} fill="none" stroke={PEN} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />

      {/* Remarks: a bracket under each stop, with the city and what happened there */}
      <text x={30} y={GRID_BOTTOM + 30} fontSize={15} fontWeight={700}>Remarks</text>
      <line x1={30} x2={30} y1={GRID_BOTTOM + 42} y2={632} stroke={INK} strokeWidth={2.5} />
      <text x={42} y={520} fontSize={12} fontWeight={700}>Shipping</text>
      <text x={42} y={535} fontSize={12} fontWeight={700}>Documents:</text>
      <text x={42} y={564} className="sheet-value" fontSize={13}>{details.shipment}</text>
      <line x1={42} x2={138} y1={570} y2={570} stroke={INK} />
      <text x={42} y={583} fontSize={9}>DVL or Manifest No. or</text>
      <text x={42} y={595} fontSize={9}>Shipper &amp; Commodity</text>

      {stops.map((stop) => {
        const left = x(stop.start)
        const right = x(stop.end)
        const labelX = Math.max(left, lastLabelX + 17)
        lastLabelX = labelX
        return (
          <g key={stop.start}>
            <path d={`M${left},${GRID_BOTTOM + 2} V${GRID_BOTTOM + 14} H${right} V${GRID_BOTTOM + 2}`} fill="none" stroke={PEN} strokeWidth={1.5} />
            <line x1={left} y1={GRID_BOTTOM + 14} x2={labelX} y2={GRID_BOTTOM + 22} stroke={PEN} strokeWidth={1} />
            <text transform={`translate(${labelX + 3},${GRID_BOTTOM + 30}) rotate(48)`} fontSize={11.5}>
              <tspan fontWeight={700}>{stop.location}</tspan> — {stop.notes.join(', ')}
            </text>
          </g>
        )
      })}

      {/* Recap */}
      <line x1={30} x2={1070} y1={640} y2={640} stroke={INK} strokeWidth={2.5} />
      <text x={30} y={662} fontSize={11} fontWeight={700}>Recap:</text>
      <text x={30} y={676} fontSize={10}>Complete at end of day</text>
      <text x={30} y={700} fontSize={10}>Enter name of place you reported and where released from work</text>
      <text x={30} y={713} fontSize={10}>and when and where each change of duty occurred.</text>
      <text x={30} y={726} fontSize={10}>Use time standard of home terminal.</text>

      <text x={470} y={662} textAnchor="middle" fontSize={11} fontWeight={700}>70 Hour / 8 Day Drivers</text>
      {[
        { left: 330, value: decimalHours(day.on_duty_today), caption: ['On duty hours today,', 'total lines 3 & 4'] },
        { left: 500, value: decimalHours(day.cycle_used), caption: ['A. Total hours on duty last', '8 days including today'] },
        { left: 670, value: decimalHours(day.cycle_available), caption: ['B. Total hours available', 'tomorrow (70 hr. minus A)'] },
      ].map((item) => (
        <g key={item.left}>
          <text x={item.left + 70} y={700} textAnchor="middle" className="sheet-value" fontSize={18}>{item.value}</text>
          <line x1={item.left + 20} x2={item.left + 120} y1={706} y2={706} stroke={INK} />
          {item.caption.map((line, index) => (
            <text key={line} x={item.left + 70} y={722 + index * 13} textAnchor="middle" fontSize={10}>{line}</text>
          ))}
        </g>
      ))}
      <text x={860} y={690} fontSize={10}>
        * If you took 34 consecutive hours off duty
        <tspan x={860} dy={13}>you have 70 hours available.</tspan>
        {tookRestart && <tspan x={860} dy={18} fontWeight={700} fill={PEN}>34-hour restart taken on this log.</tspan>}
      </text>
    </svg>
  )
}
