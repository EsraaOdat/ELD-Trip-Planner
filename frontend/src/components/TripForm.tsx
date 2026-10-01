import { useState } from 'react'
import type { FormEvent } from 'react'
import { KIND_STYLE, nextQuarterHour } from '../format'
import { useI18n } from '../i18n'
import type { Place, SheetDetails, TripRequest } from '../types'
import LocationInput from './LocationInput'

interface Props {
  loading: boolean
  details: SheetDetails
  onDetailsChange: (details: SheetDetails) => void
  onSubmit: (trip: TripRequest) => void
}

const EXAMPLE: Record<'current' | 'pickup' | 'dropoff', Place> = {
  current: { label: 'Chicago, IL', lat: 41.8756, lng: -87.6244 },
  pickup: { label: 'Dallas, TX', lat: 32.7763, lng: -96.7969 },
  dropoff: { label: 'Los Angeles, CA', lat: 34.0537, lng: -118.2428 },
}

const DETAIL_FIELDS: { key: keyof SheetDetails; placeholder: string }[] = [
  { key: 'driver', placeholder: 'John E. Doe' },
  { key: 'carrier', placeholder: "John Doe's Transportation" },
  { key: 'office', placeholder: 'Washington, D.C.' },
  { key: 'vehicle', placeholder: '123, 20544' },
  { key: 'shipment', placeholder: '101601' },
]

export default function TripForm({ loading, details, onDetailsChange, onSubmit }: Props) {
  const { t } = useI18n()
  const [current, setCurrent] = useState<Place>({ label: '' })
  const [pickup, setPickup] = useState<Place>({ label: '' })
  const [dropoff, setDropoff] = useState<Place>({ label: '' })
  const [cycleUsed, setCycleUsed] = useState('0')
  const [startTime, setStartTime] = useState(nextQuarterHour)

  const cycleHours = Math.min(70, Math.max(0, Number(cycleUsed) || 0))

  const submit = (event: FormEvent) => {
    event.preventDefault()
    onSubmit({
      current_location: current,
      pickup_location: pickup,
      dropoff_location: dropoff,
      current_cycle_used: cycleHours,
      start_time: startTime,
    })
  }

  const fillExample = () => {
    setCurrent(EXAMPLE.current)
    setPickup(EXAMPLE.pickup)
    setDropoff(EXAMPLE.dropoff)
    setCycleUsed('30')
  }

  return (
    <form className="card trip-form" onSubmit={submit}>
      <div className="card-head">
        <h2>{t('form.title')}</h2>
        <button type="button" className="link" onClick={fillExample}>
          {t('form.example')}
        </button>
      </div>

      <div className="route-fields">
        <LocationInput
          label={t('form.current')}
          placeholder={t('form.placeholder')}
          marker={KIND_STYLE.start.glyph}
          markerColor={KIND_STYLE.start.color}
          value={current}
          onChange={setCurrent}
        />
        <LocationInput
          label={t('form.pickup')}
          placeholder={t('form.placeholder')}
          marker={KIND_STYLE.pickup.glyph}
          markerColor={KIND_STYLE.pickup.color}
          value={pickup}
          onChange={setPickup}
        />
        <LocationInput
          label={t('form.dropoff')}
          placeholder={t('form.placeholder')}
          marker={KIND_STYLE.dropoff.glyph}
          markerColor={KIND_STYLE.dropoff.color}
          value={dropoff}
          onChange={setDropoff}
        />
      </div>

      <div className="field">
        <label htmlFor="cycle-used">{t('form.cycle')}</label>
        <div className="cycle-row">
          <input
            id="cycle-used"
            type="number"
            min={0}
            max={70}
            step={0.25}
            required
            value={cycleUsed}
            onChange={(event) => setCycleUsed(event.target.value)}
          />
          <input
            type="range"
            min={0}
            max={70}
            step={0.25}
            value={cycleHours}
            aria-label={t('form.cycle')}
            onChange={(event) => setCycleUsed(event.target.value)}
          />
        </div>
        <p className="hint">{t('form.cycleLeft', { hours: 70 - cycleHours })}</p>
      </div>

      <div className="field">
        <label htmlFor="start-time">{t('form.start')}</label>
        <input
          id="start-time"
          type="datetime-local"
          step={900}
          required
          value={startTime}
          onChange={(event) => setStartTime(event.target.value)}
        />
        <p className="hint">{t('form.startHint')}</p>
      </div>

      <details className="sheet-details">
        <summary>{t('form.details')}</summary>
        {DETAIL_FIELDS.map(({ key, placeholder }) => (
          <div className="field" key={key}>
            <label htmlFor={`detail-${key}`}>{t(`form.${key}`)}</label>
            <input
              id={`detail-${key}`}
              type="text"
              placeholder={placeholder}
              value={details[key]}
              onChange={(event) => onDetailsChange({ ...details, [key]: event.target.value })}
            />
          </div>
        ))}
      </details>

      <button type="submit" className="primary" disabled={loading}>
        {loading ? t('form.loading') : t('form.submit')}
      </button>

      <ul className="assumptions">
        <li>{t('form.assume1')}</li>
        <li>{t('form.assume2')}</li>
        <li>{t('form.assume3')}</li>
      </ul>
    </form>
  )
}
