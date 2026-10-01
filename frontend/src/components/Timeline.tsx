import { STATUS_LABEL, clock, dayLabel, duration, miles } from '../format'
import type { TripEvent, TripPlan } from '../types'

/** The trip schedule, grouped by the day each activity starts on. */
export default function Timeline({ plan }: { plan: TripPlan }) {
  const days = new Map<string, TripEvent[]>()
  for (const event of plan.timeline) {
    const date = event.start.slice(0, 10)
    days.set(date, [...(days.get(date) ?? []), event])
  }

  return (
    <div className="timeline">
      {[...days].map(([date, events]) => (
        <section key={date}>
          <h3>{dayLabel(date)}</h3>
          <ol>
            {events.map((event, index) => {
              const next = plan.timeline[plan.timeline.indexOf(event) + 1]
              return (
                <li key={index} className={`event ${event.status}`}>
                  <time>
                    {clock(event.start)} – {clock(event.end)}
                  </time>
                  <span className="event-dot" aria-hidden="true" />
                  <div>
                    <strong>
                      {event.kind === 'drive' ? `Drive ${miles(event.miles)}` : event.note}
                      <span className="event-duration">{duration(event.minutes)}</span>
                    </strong>
                    <span className="event-place">
                      {event.kind === 'drive' && next ? `${event.location} → ${next.location}` : event.location}
                      {' · '}
                      {STATUS_LABEL[event.status]}
                    </span>
                  </div>
                </li>
              )
            })}
          </ol>
        </section>
      ))}
    </div>
  )
}
