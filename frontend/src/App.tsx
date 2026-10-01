import { useRef, useState } from 'react'
import { planTrip } from './api'
import LogSheet from './components/LogSheet'
import RouteMap from './components/RouteMap'
import Summary from './components/Summary'
import Timeline from './components/Timeline'
import TripForm from './components/TripForm'
import { KIND_STYLE, dayLabel, duration, miles } from './format'
import type { SheetDetails, TripPlan, TripRequest } from './types'

const LEGEND = [
  ['start', 'Start'],
  ['pickup', 'Pickup'],
  ['dropoff', 'Drop-off'],
  ['fuel', 'Fuel'],
  ['break', '30-min break'],
  ['rest', '10-hr rest'],
  ['restart', '34-hr restart'],
] as const

export default function App() {
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
      setError(failure instanceof Error ? failure.message : 'Something went wrong.')
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
            <h1>ELD Trip Planner</h1>
            <p>HOS-compliant routes and daily logs for property-carrying drivers</p>
          </div>
        </div>
      </header>

      <main className="layout">
        <aside>
          <TripForm loading={loading} details={details} onDetailsChange={setDetails} onSubmit={submit} />
          {error && (
            <p className="error" role="alert">
              {error}
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
                  <strong>Enter a trip to see the route</strong>
                  <span>You get the route with every required stop, and a filled-out log sheet for each day.</span>
                </div>
              )}
              {loading && <div className="map-empty">Calculating route and hours of service…</div>}
            </div>
            {plan && (
              <>
                <ul className="legend">
                  {LEGEND.map(([kind, label]) => (
                    <li key={kind}>
                      <span className="map-pin small" style={{ background: KIND_STYLE[kind].color }}>
                        {KIND_STYLE[kind].glyph}
                      </span>
                      {label}
                    </li>
                  ))}
                </ul>
                <div className="legs">
                  {plan.legs.map((leg) => (
                    <div key={leg.name} className="leg">
                      <strong>{leg.name}</strong>
                      <span>
                        {miles(leg.miles)} · {duration(leg.driving_minutes)} driving
                      </span>
                      {leg.directions.length > 0 && (
                        <p>{[...new Set(leg.directions.map((step) => step.road))].slice(0, 10).join(' → ')}</p>
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
                  <h2>Trip schedule</h2>
                  <span className="muted">Stops and rests required by the hours-of-service rules</span>
                </div>
                <Timeline plan={plan} />
              </section>

              <section className="card logs">
                <div className="card-head">
                  <h2>Daily log sheets</h2>
                  <button type="button" className="secondary" onClick={() => window.print()}>
                    Print all {plan.days.length} sheets
                  </button>
                </div>
                <div className="tabs" role="tablist" aria-label="Log sheet day">
                  {plan.days.map((day, index) => (
                    <button
                      key={day.date}
                      type="button"
                      role="tab"
                      aria-selected={index === activeDay}
                      className={index === activeDay ? 'active' : undefined}
                      onClick={() => setActiveDay(index)}
                    >
                      <span>Day {index + 1}</span>
                      {dayLabel(day.date)}
                    </button>
                  ))}
                </div>
                <div className="sheets">
                  {plan.days.map((day, index) => (
                    <div key={day.date} className={`sheet${index === activeDay ? ' active' : ''}`}>
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
