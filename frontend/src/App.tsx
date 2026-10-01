import { useRef, useState } from 'react'
import { planTrip } from './api'
import LogSheet from './components/LogSheet'
import RouteMap from './components/RouteMap'
import Summary from './components/Summary'
import Timeline from './components/Timeline'
import TripForm from './components/TripForm'
import { KIND_STYLE } from './format'
import { useI18n, useTheme } from './i18n'
import type { SheetDetails, TripPlan, TripRequest } from './types'

const LEGEND = ['start', 'pickup', 'dropoff', 'fuel', 'break', 'rest', 'restart'] as const

export default function App() {
  const { t, toggleLang, dayLabel, duration, miles } = useI18n()
  const { theme, toggleTheme } = useTheme()
  const [plan, setPlan] = useState<TripPlan | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeDay, setActiveDay] = useState(0)
  const [details, setDetails] = useState<SheetDetails>({ driver: '', carrier: '', office: '', vehicle: '', shipment: '' })
  const results = useRef<HTMLDivElement>(null)

  const submit = async (trip: TripRequest) => {
    setLoading(true)
    setError('')
    try {
      setPlan(await planTrip(trip))
      setActiveDay(0)
      results.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'error.unknown')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true">
            <rect width="32" height="32" rx="7" fill="#1d4ed8" />
            <path d="M5 11h5v10h5v-6h6v-5h6" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div>
            <h1>{t('app.title')}</h1>
            <p>{t('app.subtitle')}</p>
          </div>
          <div className="topbar-actions">
            <button type="button" className="topbar-button" onClick={toggleLang}>
              {t('app.switchLanguage')}
            </button>
            <button
              type="button"
              className="topbar-button icon"
              onClick={toggleTheme}
              aria-label={t(theme === 'dark' ? 'app.lightMode' : 'app.darkMode')}
              title={t(theme === 'dark' ? 'app.lightMode' : 'app.darkMode')}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {theme === 'dark' ? (
                  <>
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
                  </>
                ) : (
                  <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </header>

      <main className="layout">
        <aside>
          <TripForm loading={loading} details={details} onDetailsChange={setDetails} onSubmit={submit} />
          {error && (
            <p className="error" role="alert">
              {t(error)}
            </p>
          )}
        </aside>

        <div className="results" ref={results}>
          {plan && <Summary plan={plan} />}

          <section className="card map-card">
            <div className={`map-wrap${loading ? ' busy' : ''}`}>
              <RouteMap plan={plan} />
              {!plan && !loading && (
                <div className="map-empty">
                  <strong>{t('map.emptyTitle')}</strong>
                  <span>{t('map.emptyText')}</span>
                </div>
              )}
              {loading && <div className="map-empty">{t('map.loading')}</div>}
            </div>
            {plan && (
              <>
                <ul className="legend">
                  {LEGEND.map((kind) => (
                    <li key={kind}>
                      <span className="map-pin small" style={{ background: KIND_STYLE[kind].color }}>
                        {KIND_STYLE[kind].glyph}
                      </span>
                      {t(`stop.${kind}`)}
                    </li>
                  ))}
                </ul>
                <div className="legs">
                  {plan.legs.map((leg, index) => (
                    <div key={leg.name} className="leg">
                      <strong>{t(`leg.${index}`)}</strong>
                      <span>
                        {miles(leg.miles)} · {t('map.driving', { time: duration(leg.driving_minutes) })}
                      </span>
                      {leg.directions.length > 0 && (
                        <p dir="ltr">{[...new Set(leg.directions.map((step) => step.road))].slice(0, 10).join(' → ')}</p>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>

          {plan && (
            <>
              <section className="card">
                <div className="card-head">
                  <h2>{t('schedule.title')}</h2>
                  <span className="muted">{t('schedule.subtitle')}</span>
                </div>
                <Timeline plan={plan} />
              </section>

              <section className="card logs">
                <div className="card-head">
                  <h2>{t('logs.title')}</h2>
                  <button type="button" className="secondary" onClick={() => window.print()}>
                    {t('logs.print', { n: plan.days.length })}
                  </button>
                </div>
                <div className="tabs" role="tablist" aria-label={t('logs.tabs')}>
                  {plan.days.map((day, index) => (
                    <button
                      key={day.date}
                      type="button"
                      role="tab"
                      aria-selected={index === activeDay}
                      className={index === activeDay ? 'active' : undefined}
                      onClick={() => setActiveDay(index)}
                    >
                      <span>{t('logs.day', { n: index + 1 })}</span>
                      {dayLabel(day.date)}
                    </button>
                  ))}
                </div>
                <div className="sheets">
                  {plan.days.map((day, index) => (
                    <div key={day.date} dir="ltr" className={`sheet${index === activeDay ? ' active' : ''}`}>
                      <LogSheet day={day} details={details} />
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      </main>
    </>
  )
}
