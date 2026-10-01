import { useEffect } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet'
import { KIND_STYLE } from '../format'
import { useI18n } from '../i18n'
import type { TripPlan } from '../types'

const US_CENTER: [number, number] = [39.5, -98.35]
const LEG_COLORS = ['#64748b', '#1d4ed8']

function pin(kind: keyof typeof KIND_STYLE, large = false) {
  const { color, glyph } = KIND_STYLE[kind]
  const size = large ? 34 : 26
  return L.divIcon({
    className: '',
    html: `<span class="map-pin${large ? ' large' : ''}" style="background:${color}">${glyph}</span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  })
}

function FitRoute({ plan }: { plan: TripPlan }) {
  const map = useMap()
  useEffect(() => {
    const points = plan.legs.flatMap((leg) => leg.path)
    map.fitBounds(L.latLngBounds(points), { padding: [40, 40] })
  }, [map, plan])
  return null
}

export default function RouteMap({ plan }: { plan: TripPlan | null }) {
  const { t, clock, dayLabel, duration } = useI18n()
  return (
    <MapContainer center={US_CENTER} zoom={4} scrollWheelZoom className="map">
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      {plan && (
        <>
          <FitRoute plan={plan} />
          {plan.legs.map((leg, index) => (
            <Polyline key={leg.name} positions={leg.path} pathOptions={{ color: LEG_COLORS[index], weight: 5, opacity: 0.85 }} />
          ))}

          <Marker position={[plan.locations.current.lat, plan.locations.current.lng]} icon={pin('start', true)}>
            <Popup>
              <strong>{t('stop.start')}</strong>
              <br />
              {plan.locations.current.label}
              <br />
              {dayLabel(plan.summary.departure)}, {clock(plan.summary.departure)}
            </Popup>
          </Marker>

          {plan.stops.map((stop) => (
            <Marker
              key={stop.start}
              position={[stop.lat, stop.lng]}
              icon={pin(stop.kind, stop.kind === 'pickup' || stop.kind === 'dropoff')}
              zIndexOffset={stop.kind === 'pickup' || stop.kind === 'dropoff' ? 500 : 0}
            >
              <Popup>
                <strong>{t(`stop.${stop.kind}`)}</strong> · {duration(stop.minutes)}
                <br />
                {stop.location} · {t('map.mile', { n: stop.mile_marker.toLocaleString('en-US') })}
                <br />
                {dayLabel(stop.start)}, {clock(stop.start)} – {clock(stop.end)}
              </Popup>
            </Marker>
          ))}
        </>
      )}
    </MapContainer>
  )
}
