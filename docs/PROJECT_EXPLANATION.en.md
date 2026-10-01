# ELD Trip Planner — Project Explanation

Full Stack Developer assessment, Spotter AI. Submitted by Esraa Odat.

| Deliverable | Link |
| --- | --- |
| Live app | _add the hosted URL_ |
| Source code | _add the GitHub URL_ |
| Walkthrough video | _add the Loom URL_ |

## 1. What the app does

The app takes a truck trip and returns a plan the driver can legally drive, with the daily logs already filled out.

**Inputs**

- Current location
- Pickup location
- Dropoff location
- Current cycle used (hours, 0–70)
- Start time (defaults to the next quarter hour)

**Outputs**

- A map of the route with every stop: pickup, drop-off, fuel, 30-minute breaks, 10-hour rests and 34-hour restarts.
- A trip schedule listing each activity with its time, place and duration.
- One daily log sheet per calendar day, with the duty-status line drawn on the grid, the totals, the remarks and the 70-hour recap. Sheets can be printed, one per page.

The interface is available in English and Arabic (right to left), with light and dark themes.

## 2. Stack

| Part | Technology | Notes |
| --- | --- | --- |
| Backend | Django 5, Django REST Framework | Stateless; no database |
| Frontend | React 19, TypeScript, Vite | Single page |
| Map | Leaflet with OpenStreetMap tiles | Free, no API key |
| Routing | OSRM public server | Distance, duration, route geometry, road names |
| Address search | Photon | Free, no API key |
| Stop names | GeoNames city list bundled in the repository | Instant, works offline |
| Log sheet | SVG drawn in React | Sharp at any size and in print |

## 3. Architecture

```
Browser (React)
   │  POST /api/trips/plan/
   ▼
views.py ──► routing.py ──► Photon (address → coordinates)
   │              └──────► OSRM   (route, distance, duration)
   └──────► hos.py  (duty-status schedule; pure Python, no network)
   │
   ▼
JSON: locations, legs, summary, stops, timeline, days
```

A request is handled in these steps:

1. The form sends the three locations, the cycle hours and the start time.
2. `serializers.py` validates the input. Invalid input returns HTTP 400.
3. `routing.py` resolves any location typed as free text into coordinates.
4. `routing.py` requests two legs from OSRM in parallel: current → pickup and pickup → dropoff.
5. `hos.py` turns the two legs into a timeline of duty-status segments.
6. `views.py` finds where on the route each segment starts and names it after the nearest city.
7. `hos.py` cuts the timeline at each midnight into daily logs.
8. The response is one JSON document. The frontend renders the map, summary, schedule and log sheets from it.

### API

| Endpoint | Purpose |
| --- | --- |
| `POST /api/trips/plan/` | Plans a trip |
| `GET /api/geocode/?q=` | Address suggestions for the form |
| `GET /api/health/` | Health check |

## 4. Hours-of-service rules

Rules follow the FMCSA *Interstate Truck Driver's Guide to Hours of Service* (49 CFR 395) for a property-carrying driver.

| Rule | Limit | What the planner does at the limit |
| --- | --- | --- |
| Driving limit | 11 hours after 10 consecutive hours off | 10-hour rest in the sleeper berth |
| Driving window | No driving after the 14th hour on duty | 10-hour rest in the sleeper berth |
| Rest break | 30 minutes after 8 cumulative hours of driving | 30-minute off-duty break |
| Cycle | 70 on-duty hours in 8 days | 34-hour restart |
| Fuel | At least once every 1,000 miles | 30-minute on-duty stop |
| Pickup and drop-off | 1 hour each | On duty, not driving |

Three details of the rules are implemented as the guide describes them:

- Any 30 consecutive minutes without driving satisfy the break, including on-duty time. A fuel stop or the pickup hour therefore counts as the break.
- The limits restrict driving only. On-duty work such as the drop-off may happen after the 14th hour.
- A short break does not pause the 14-hour window. Only 10 consecutive hours off duty reset it.

## 5. The scheduling algorithm (`backend/trips/hos.py`)

The planner simulates the trip the way a driver would run it: drive until the nearest limit, take the stop that limit requires, continue.

Time is kept in whole minutes from midnight of the first day. Everything stays on 15-minute marks, the resolution of a paper log grid.

**Clocks tracked**

| Variable | Counts | Reset by |
| --- | --- | --- |
| `shift_driving` | Driving in the current shift | 10 hours of rest |
| `window_start` | When the current shift began | 10 hours of rest |
| `driving_since_break` | Driving since the last break | 30 consecutive non-driving minutes |
| `cycle` | On-duty time in the 8-day cycle | 34 hours of rest |
| `miles_since_fuel` | Miles since the last fuel stop | A fuel stop |

**Driving loop**

1. If no shift is open, start one with a 15-minute pre-trip inspection.
2. Compute the minutes remaining before each of the five limits.
3. Take the smallest value. That is the nearest limit.
4. If it is zero, add the required stop and go back to step 1.
5. Otherwise drive for that long, or for the rest of the leg if shorter.
6. Repeat until the leg is finished.

When two limits are reached at the same moment, the stop that covers both is taken: restart, then 10-hour rest, then fuel, then 30-minute break. A driver who needs a 10-hour rest never takes a 30-minute break first.

**Whole trip**

1. Off duty from midnight until the start time.
2. Drive to the pickup.
3. One hour on duty for pickup.
4. Drive to the drop-off.
5. One hour on duty for drop-off.
6. Off duty until midnight, so the last sheet covers 24 hours.

`build_days` then cuts the timeline at each midnight. For each day it computes the hours per duty status (always 24 in total), the miles driven, and the cycle hours used and remaining.

## 6. Maps and locations (`backend/trips/routing.py`)

| Function | Purpose |
| --- | --- |
| `geocode` | Text to a list of places with coordinates (Photon) |
| `route_leg` | Miles, driving minutes, route points and main roads between two points (OSRM) |
| `point_at` | Coordinates reached after a given number of miles along a leg |
| `nearest_city` | Nearest city as "City, ST", from the bundled list |

The scheduler reports where each stop happens as a distance, for example "break at mile 448". `point_at` converts that distance into coordinates along the route, and `nearest_city` names it. That name appears on the map, in the schedule and in the Remarks of the log sheet.

Stop names come from a bundled city list rather than a reverse-geocoding service. With the service, one request made a dozen or more network calls, took about 27 seconds and some lookups failed. With the list, a request takes about 5 seconds and every stop has a name.

OSRM durations are calculated for cars. The planner caps the average truck speed at 65 mph.

## 7. Frontend (`frontend/src`)

| File | Purpose |
| --- | --- |
| `App.tsx` | Page layout; holds the plan returned by the API |
| `components/TripForm.tsx` | The form |
| `components/LocationInput.tsx` | Location field with debounced suggestions and keyboard navigation |
| `components/RouteMap.tsx` | Route, markers and popups |
| `components/Summary.tsx` | Summary cards |
| `components/Timeline.tsx` | Trip schedule grouped by day |
| `components/LogSheet.tsx` | The daily log sheet |
| `i18n.tsx` | Translations and theme |
| `api.ts`, `types.ts` | API calls and the shape of the response |

### The log sheet

The sheet is drawn in SVG from the day's data; it is not an image with text placed on top.

| Part | How it is drawn |
| --- | --- |
| Header | Date, From/To, miles; carrier, driver and vehicle if entered in the form |
| Grid | Four rows (one per duty status), 24 hour columns, quarter-hour ticks |
| Duty line | Horizontal while in a status, vertical at each change |
| Totals | Hours per row and the 24-hour sum |
| Remarks | A bracket under each period the truck is stationary, labelled with the city and the activity |
| Recap | On-duty hours today, hours used in the 70-hour cycle, hours available tomorrow |

Every horizontal position comes from one function that maps a minute of the day to an x coordinate, so the line, the ticks and the remark brackets always align.

### Languages and themes

- All interface text lives in two dictionaries in `i18n.tsx`. Arabic switches the page to right-to-left; the CSS uses logical properties, so the layout mirrors without separate rules.
- Colours are CSS variables. The dark theme changes the variable values only.
- Both choices are saved in the browser. The first visit follows the system setting.
- The log sheet stays in English and on white in every mode, because it reproduces a US DOT form. City names also stay in English, as they are written in the Remarks.

## 8. Testing

```bash
cd backend
python manage.py test
```

There are 10 tests and all pass. Each generated plan is replayed by `check_compliance`, a checker written separately from the planner, which asserts every rule on every segment. The planner is therefore not verified by its own logic.

| Test | Asserts |
| --- | --- |
| Short trip | Fits in one day with no extra stops |
| 30-minute break | Taken after exactly 8 hours of driving |
| Pickup hour | Counts as the break; no extra break is added |
| 11-hour limit | Forces a 10-hour sleeper-berth rest |
| Fuel | Two stops on a 2,800-mile trip |
| 70-hour limit | Forces a 34-hour restart that clears the cycle |
| Exhausted cycle | The restart happens before any work |
| Cross-country trip | Every day totals 24 hours; daily miles add up to the trip distance |
| Many trips | 60 combinations of distance, cycle hours and start time are all compliant |
| Invalid input | Cycle hours above 70 are rejected |

The app was also run end to end in a browser with Chicago → Dallas → Los Angeles and 30 cycle hours used. The result was 2,404 miles over 5 log sheets, each totalling 24 hours.

## 9. Assumptions and limitations

**Given by the assessment**

- Property-carrying driver, 70 hours / 8 days, no adverse driving conditions.
- Fuel at least once every 1,000 miles.
- One hour each for pickup and drop-off.

**Added**

- The driver starts the trip fully rested.
- Each shift starts with a 15-minute pre-trip inspection.
- A fuel stop takes 30 minutes.
- Times are in the home-terminal time zone, on 15-minute marks.
- Average truck speed is capped at 65 mph.

**Limitations**

- "Current cycle used" is a single number, so its distribution over the previous days is unknown. Those hours are kept for the whole trip and the cycle is recovered only by a 34-hour restart. This is conservative: the plan never allows more driving than the rule does.
- The split sleeper-berth provision is not used. Rests are always 10 consecutive hours.
- OSRM and Photon are public servers. If one is unavailable, the app shows an error message.
- Error messages returned by the server are in English in both languages.

## 10. Run locally

Backend (Python 3.12+):

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
python manage.py runserver
```

Frontend (Node 20+), in a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. The dev server forwards `/api` to Django on port 8000.

## Credits

Map data © OpenStreetMap contributors. City list from GeoNames (CC BY 4.0).
