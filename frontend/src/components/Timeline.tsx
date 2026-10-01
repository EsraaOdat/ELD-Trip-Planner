import { useI18n } from '../i18n'
import type { TripEvent, TripPlan } from '../types'

/** The trip schedule, grouped by the day each activity starts on. */
export default function Timeline({ plan }: { plan: TripPlan }) {
  const { t, duration, miles, clock, dayLabel } = useI18n()
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
                      {t(`stop.${event.kind}`, { miles: miles(event.miles) })}
                      <span className="event-duration">{duration(event.minutes)}</span>
                    </strong>
                    <span className="event-place">
                      {/* City names are English, so keep "A → B" reading left to right. */}
                      <bdi dir="ltr">{event.kind === 'drive' && next ? `${event.location} → ${next.location}` : event.location}</bdi>
                      {' · '}
                      {t(`status.${event.status}`)}
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
