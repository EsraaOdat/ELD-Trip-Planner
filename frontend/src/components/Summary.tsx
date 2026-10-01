import { clock, dayLabel, duration, miles } from '../format'
import type { TripPlan } from '../types'

const CYCLE_MINUTES = 70 * 60

export default function Summary({ plan }: { plan: TripPlan }) {
  const { summary } = plan
  const stops = [
    summary.stops.rest && `${summary.stops.rest} × 10-hr rest`,
    summary.stops.fuel && `${summary.stops.fuel} × fuel`,
    summary.stops.break && `${summary.stops.break} × 30-min break`,
    summary.stops.restart && `${summary.stops.restart} × 34-hr restart`,
  ].filter(Boolean)

  return (
    <section className="stats" aria-label="Trip summary">
      <div className="stat">
        <span className="stat-label">Total distance</span>
        <strong>{miles(summary.total_miles)}</strong>
        <span className="stat-sub">{plan.legs.map((leg) => miles(leg.miles)).join(' + ')}</span>
      </div>
      <div className="stat">
        <span className="stat-label">Driving time</span>
        <strong>{duration(summary.driving_minutes)}</strong>
        <span className="stat-sub">{duration(summary.trip_minutes)} door to door</span>
      </div>
      <div className="stat">
        <span className="stat-label">Arrival</span>
        <strong>{dayLabel(summary.arrival)}</strong>
        <span className="stat-sub">{clock(summary.arrival)}, drop-off complete</span>
      </div>
      <div className="stat">
        <span className="stat-label">Log sheets</span>
        <strong>
          {summary.days} {summary.days === 1 ? 'day' : 'days'}
        </strong>
        <span className="stat-sub">{stops.length ? stops.join(', ') : 'No rest stops needed'}</span>
      </div>
      <div className="stat">
        <span className="stat-label">Cycle after trip</span>
        <strong>{duration(summary.cycle_used_end)} / 70h</strong>
        <span className="meter" role="img" aria-label={`${duration(summary.cycle_used_end)} of 70 hours used`}>
          <span style={{ width: `${(summary.cycle_used_end / CYCLE_MINUTES) * 100}%` }} />
        </span>
      </div>
    </section>
  )
}
