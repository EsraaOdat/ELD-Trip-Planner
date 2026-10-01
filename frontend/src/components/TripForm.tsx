import { useState } from 'react'
import type { FormEvent } from 'react'
import { KIND_STYLE, nextQuarterHour } from '../format'
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

const DETAIL_FIELDS: { key: keyof SheetDetails; label: string; placeholder: string }[] = [
  { key: 'driver', label: 'Driver name', placeholder: 'John E. Doe' },
  { key: 'carrier', label: 'Carrier name', placeholder: "John Doe's Transportation" },
  { key: 'office', label: 'Main office address', placeholder: 'Washington, D.C.' },
  { key: 'vehicle', label: 'Truck / trailer numbers', placeholder: '123, 20544' },
  { key: 'shipment', label: 'Shipping document or commodity', placeholder: '101601' },
]

export default function TripForm({ loading, details, onDetailsChange, onSubmit }: Props) {
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
        <h2>Trip details</h2>
        <button type="button" className="link" onClick={fillExample}>
          Try an example
        </button>
      </div>

      <div className="route-fields">
        <LocationInput
          label="Current location"
          placeholder="City or address"
          marker={KIND_STYLE.start.glyph}
          markerColor={KIND_STYLE.start.color}
          value={current}
          onChange={setCurrent}
        />
        <LocationInput
          label="Pickup location"
          placeholder="City or address"
          marker={KIND_STYLE.pickup.glyph}
          markerColor={KIND_STYLE.pickup.color}
          value={pickup}
          onChange={setPickup}
        />
        <LocationInput
          label="Dropoff location"
          placeholder="City or address"
          marker={KIND_STYLE.dropoff.glyph}
          markerColor={KIND_STYLE.dropoff.color}
          value={dropoff}
          onChange={setDropoff}
        />
      </div>

      <div className="field">
        <label htmlFor="cycle-used">Current cycle used (hrs)</label>
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
            aria-label="Current cycle used"
            onChange={(event) => setCycleUsed(event.target.value)}
          />
        </div>
        <p className="hint">{70 - cycleHours} of 70 hours left in the 8-day cycle</p>
      </div>

      <div className="field">
        <label htmlFor="start-time">Start time</label>
        <input
          id="start-time"
          type="datetime-local"
          step={900}
          required
          value={startTime}
          onChange={(event) => setStartTime(event.target.value)}
        />
        <p className="hint">Home terminal time. The driver starts fully rested.</p>
      </div>

      <details className="sheet-details">
        <summary>Log sheet details (optional)</summary>
        {DETAIL_FIELDS.map(({ key, label, placeholder }) => (
          <div className="field" key={key}>
            <label htmlFor={`detail-${key}`}>{label}</label>
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
        {loading ? 'Planning trip…' : 'Plan trip'}
      </button>

      <ul className="assumptions">
        <li>Property-carrying driver, 70 hrs / 8 days</li>
        <li>Fuel at least every 1,000 miles</li>
        <li>1 hour each for pickup and drop-off</li>
      </ul>
    </form>
  )
}
