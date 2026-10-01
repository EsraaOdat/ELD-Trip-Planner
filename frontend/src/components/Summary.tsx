import { useI18n } from '../i18n'
import type { TripPlan } from '../types'

const CYCLE_MINUTES = 70 * 60

export default function Summary({ plan }: { plan: TripPlan }) {
  const { t, lang, duration, miles, clock, dayLabel } = useI18n()
  const { summary } = plan
  const stops = (['rest', 'fuel', 'break', 'restart'] as const)
    .filter((kind) => summary.stops[kind])
    .map((kind) => t(`summary.count.${kind}`, { n: summary.stops[kind] }))

  return (
    <section className="stats" aria-label={t('summary.label')}>
      <div className="stat">
        <span className="stat-label">{t('summary.distance')}</span>
        <strong>{miles(summary.total_miles)}</strong>
        <span className="stat-sub">{plan.legs.map((leg) => miles(leg.miles)).join(' + ')}</span>
      </div>
      <div className="stat">
        <span className="stat-label">{t('summary.driving')}</span>
        <strong>{duration(summary.driving_minutes)}</strong>
        <span className="stat-sub">{t('summary.doorToDoor', { time: duration(summary.trip_minutes) })}</span>
      </div>
      <div className="stat">
        <span className="stat-label">{t('summary.arrival')}</span>
        <strong>{dayLabel(summary.arrival)}</strong>
        <span className="stat-sub">{t('summary.arrivalSub', { time: clock(summary.arrival) })}</span>
      </div>
      <div className="stat">
        <span className="stat-label">{t('summary.sheets')}</span>
        <strong>{t(summary.days === 1 ? 'summary.day' : 'summary.days', { n: summary.days })}</strong>
        <span className="stat-sub">{stops.length ? stops.join(lang === 'ar' ? '، ' : ', ') : t('summary.noStops')}</span>
      </div>
      <div className="stat">
        <span className="stat-label">{t('summary.cycle')}</span>
        <strong dir="ltr">{duration(summary.cycle_used_end)} / 70{t('unit.h')}</strong>
        <span className="meter" role="img" aria-label={`${duration(summary.cycle_used_end)} / 70${t('unit.h')}`}>
          <span style={{ width: `${(summary.cycle_used_end / CYCLE_MINUTES) * 100}%` }} />
        </span>
      </div>
    </section>
  )
}
