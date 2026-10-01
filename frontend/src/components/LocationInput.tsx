import { useEffect, useId, useRef, useState } from 'react'
import { searchPlaces } from '../api'
import { useI18n } from '../i18n'
import type { Place } from '../types'

interface Props {
  label: string
  placeholder: string
  marker: string
  markerColor: string
  value: Place
  onChange: (place: Place) => void
}

/** Text field with address suggestions. Free text is also accepted. */
export default function LocationInput({ label, placeholder, marker, markerColor, value, onChange }: Props) {
  const id = useId()
  const { t } = useI18n()
  const [suggestions, setSuggestions] = useState<Required<Place>[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const typed = useRef(false)

  useEffect(() => {
    // Only search for text the user typed, not for a suggestion they just picked.
    if (!typed.current || value.label.trim().length < 3) {
      setSuggestions([])
      return
    }
    const controller = new AbortController()
    const timer = setTimeout(() => {
      searchPlaces(value.label.trim(), controller.signal)
        .then((places) => {
          setSuggestions(places)
          setActive(0)
          setOpen(true)
        })
        .catch(() => {})
    }, 300)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [value.label])

  const pick = (place: Required<Place>) => {
    typed.current = false
    onChange(place)
    setOpen(false)
  }

  const showList = open && suggestions.length > 0

  return (
    <div className="field location">
      <label htmlFor={id}>{label}</label>
      <div className="location-control">
        <span className="location-marker" style={{ background: markerColor }} aria-hidden="true">
          {marker}
        </span>
        <input
          id={id}
          type="text"
          autoComplete="off"
          required
          role="combobox"
          aria-expanded={showList}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          placeholder={placeholder}
          value={value.label}
          onChange={(event) => {
            typed.current = true
            onChange({ label: event.target.value })
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(event) => {
            if (!showList) return
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              setActive((active + 1) % suggestions.length)
            } else if (event.key === 'ArrowUp') {
              event.preventDefault()
              setActive((active - 1 + suggestions.length) % suggestions.length)
            } else if (event.key === 'Enter') {
              event.preventDefault()
              pick(suggestions[active])
            } else if (event.key === 'Escape') {
              setOpen(false)
            }
          }}
        />
        {value.lat !== undefined && <span className="location-ok" title={t('form.found')} aria-hidden="true">✓</span>}
      </div>
      {showList && (
        <ul className="suggestions" id={`${id}-list`} role="listbox">
          {suggestions.map((place, index) => (
            <li
              key={`${place.lat},${place.lng}`}
              role="option"
              aria-selected={index === active}
              className={index === active ? 'active' : undefined}
              // mousedown fires before the input's blur closes the list
              onMouseDown={(event) => {
                event.preventDefault()
                pick(place)
              }}
              onMouseEnter={() => setActive(index)}
            >
              {place.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
