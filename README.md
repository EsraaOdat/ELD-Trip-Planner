# ELD Trip Planner

Plan a truck trip and get an hours-of-service compliant route plus the driver's
daily log sheets, drawn and filled out automatically.

**Inputs:** current location, pickup location, dropoff location, current cycle used (hrs).

**Outputs:**

- A map of the route with every stop: pickup, drop-off, fuel, 30-minute breaks, 10-hour rests and 34-hour restarts.
- A trip schedule with times, locations and distances.
- One daily log sheet per calendar day, with the duty-status line drawn on the grid, totals, remarks and the 70-hour recap. Sheets can be printed.

## Stack

| Part | Technology |
| --- | --- |
| Backend | Django 5 + Django REST Framework (stateless, no database) |
| Frontend | React 19 + TypeScript + Vite, Leaflet for the map, SVG for the log sheets |
| Maps | OpenStreetMap tiles, OSRM for routing, Photon for address search (all free, no API key) |

## How it works

1. `POST /api/trips/plan/` receives the four inputs and a start time.
2. `backend/trips/routing.py` turns the locations into coordinates (Photon) and gets the two driving legs (OSRM): current → pickup and pickup → dropoff.
3. `backend/trips/hos.py` walks along the route and builds a duty-status timeline, stopping whenever a rule requires it.
4. The timeline is cut at each midnight into daily logs, and each stop is named after its nearest city (bundled GeoNames list).
5. The React app draws the map, the schedule and one SVG log sheet per day (`frontend/src/components/LogSheet.tsx`).

### Hours-of-service rules applied

Based on the FMCSA *Interstate Truck Driver's Guide to Hours of Service* (49 CFR 395):

| Rule | Behaviour |
| --- | --- |
| 11-hour driving limit | 10-hour rest (sleeper berth) once 11 hours are driven |
| 14-hour driving window | No driving after the 14th hour since coming on duty; 10-hour rest |
| 30-minute break | After 8 cumulative hours of driving; any 30 consecutive non-driving minutes count (fuel, pickup) |
| 70 hours / 8 days | Starts from "current cycle used"; a 34-hour restart is taken when the 70 hours run out |
| Fuel | 30-minute on-duty stop at least every 1,000 miles |
| Pickup / drop-off | 1 hour on duty (not driving) each |

### Assumptions

- Property-carrying driver, 70 hrs / 8 days, no adverse driving conditions.
- The driver starts the trip fully rested (10 hours off duty).
- A 15-minute pre-trip inspection starts each shift.
- Times are in the driver's home-terminal time and kept on 15-minute marks, like a paper log.
- "Current cycle used" is a single total, so those hours are kept for the whole trip and the cycle is recovered with a 34-hour restart.
- Truck speed is capped at a 65 mph average.

## Run locally

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

## Tests

```bash
cd backend
python manage.py test
```

The tests replay each generated timeline with an independent checker and assert every rule above.

## Deploy (Vercel)

Two Vercel projects from this one repository:

1. **Backend** — root directory `backend`. `vercel.json` runs Django through the Python runtime. Set `DJANGO_SECRET_KEY` and `DJANGO_DEBUG=0`.
2. **Frontend** — root directory `frontend` (Vite preset). Set `VITE_API_URL` to the backend URL.

## Data credits

Map data © OpenStreetMap contributors. City list from GeoNames (CC BY 4.0).
