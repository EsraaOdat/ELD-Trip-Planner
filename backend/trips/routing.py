"""
Free map services: Photon (address search, OpenStreetMap data) and the public
OSRM server (routing). Neither needs an API key. City names for stops along the
route come from a bundled GeoNames list (trips/data/cities.csv, CC BY 4.0).
"""

import csv
import math
from functools import lru_cache
from pathlib import Path

import requests

PHOTON_URL = "https://photon.komoot.io"
OSRM_URL = "https://router.project-osrm.org"
HEADERS = {"User-Agent": "eld-trip-planner/1.0 (hiring assessment demo)"}
TIMEOUT = 20

# Keep searches inside North America: west, south, east, north.
SEARCH_BBOX = "-170,15,-50,72"

METERS_PER_MILE = 1609.344
MAX_TRUCK_MPH = 65
MAX_ROUTE_POINTS = 1500
CITIES_FILE = Path(__file__).parent / "data" / "cities.csv"

STATE_ABBREVIATIONS = {
    "Alabama": "AL", "Alaska": "AK", "Arizona": "AZ", "Arkansas": "AR", "California": "CA",
    "Colorado": "CO", "Connecticut": "CT", "Delaware": "DE", "District of Columbia": "DC",
    "Florida": "FL", "Georgia": "GA", "Hawaii": "HI", "Idaho": "ID", "Illinois": "IL",
    "Indiana": "IN", "Iowa": "IA", "Kansas": "KS", "Kentucky": "KY", "Louisiana": "LA",
    "Maine": "ME", "Maryland": "MD", "Massachusetts": "MA", "Michigan": "MI", "Minnesota": "MN",
    "Mississippi": "MS", "Missouri": "MO", "Montana": "MT", "Nebraska": "NE", "Nevada": "NV",
    "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY",
    "North Carolina": "NC", "North Dakota": "ND", "Ohio": "OH", "Oklahoma": "OK", "Oregon": "OR",
    "Pennsylvania": "PA", "Rhode Island": "RI", "South Carolina": "SC", "South Dakota": "SD",
    "Tennessee": "TN", "Texas": "TX", "Utah": "UT", "Vermont": "VT", "Virginia": "VA",
    "Washington": "WA", "West Virginia": "WV", "Wisconsin": "WI", "Wyoming": "WY",
    "Alberta": "AB", "British Columbia": "BC", "Manitoba": "MB", "New Brunswick": "NB",
    "Newfoundland and Labrador": "NL", "Nova Scotia": "NS", "Ontario": "ON",
    "Prince Edward Island": "PE", "Quebec": "QC", "Québec": "QC", "Saskatchewan": "SK",
}

PLACE_TYPES = {"city", "town", "village", "hamlet", "locality", "district", "county"}


class RoutingError(Exception):
    """A map service failed or could not answer; the message is safe to show."""


def _get(url, params, timeout=TIMEOUT):
    try:
        response = requests.get(url, params=params, headers=HEADERS, timeout=timeout)
        response.raise_for_status()
        return response.json()
    except (requests.RequestException, ValueError) as exc:
        raise RoutingError("The map service is not responding. Please try again.") from exc


def _state(props):
    state = props.get("state", "")
    return STATE_ABBREVIATIONS.get(state, state)


def _city_state(props):
    """'Kansas City, MO' -- the form a log's Remarks section requires."""
    city = props.get("city")
    if not city and props.get("type") in PLACE_TYPES:
        city = props.get("name")
    city = city or props.get("county") or props.get("name")
    return ", ".join(part for part in (city, _state(props)) if part)


def _label(props):
    name = props.get("name")
    place = _city_state(props)
    if name and name != props.get("city") and not place.startswith(name):
        return f"{name}, {place}" if place else name
    return place


def geocode(query, limit=6):
    data = _get(f"{PHOTON_URL}/api/", {"q": query, "limit": limit, "lang": "en", "bbox": SEARCH_BBOX})
    results, seen = [], set()
    for feature in data.get("features", []):
        props = feature["properties"]
        label = _label(props)
        if not label or label in seen:
            continue
        seen.add(label)
        lng, lat = feature["geometry"]["coordinates"]
        results.append({"label": label, "lat": lat, "lng": lng})
    return results


@lru_cache(maxsize=1)
def _cities():
    """[(lat, lng, 'City, ST')] for North America, bundled from GeoNames."""
    with open(CITIES_FILE, encoding="utf-8", newline="") as handle:
        return [(float(lat), float(lng), f"{name}, {region}") for name, region, lat, lng in csv.reader(handle)]


def nearest_city(lat, lng):
    """
    The nearest city or town as 'City, ST', which is what a log's Remarks need.
    Looked up in a bundled list, so it is instant and never fails mid-request.
    """
    shrink = math.cos(math.radians(lat)) ** 2  # a degree of longitude is shorter than one of latitude
    best = min(_cities(), key=lambda city: (city[0] - lat) ** 2 + (city[1] - lng) ** 2 * shrink)
    return best[2]


def haversine_miles(a, b):
    lat1, lng1, lat2, lng2 = map(math.radians, (*a, *b))
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lng2 - lng1) / 2) ** 2
    return 3958.8 * 2 * math.asin(math.sqrt(h))


def _directions(steps):
    """Collapse OSRM's turn-by-turn steps into the main roads of the leg."""
    roads = []
    for step in steps:
        road = (step.get("ref") or step.get("name") or "").split(";")[0].strip()
        miles = step["distance"] / METERS_PER_MILE
        if roads and roads[-1]["road"] == road:
            roads[-1]["miles"] += miles
        else:
            roads.append({"road": road, "miles": miles})
    return [
        {"road": r["road"], "miles": round(r["miles"])}
        for r in roads
        if r["road"] and r["miles"] >= 2
    ]


def route_leg(origin, destination):
    """
    origin, destination: (lat, lng).
    Returns miles, driving minutes, the path as [lat, lng] points, the distance
    in miles at each point, and the main roads followed.
    """
    if haversine_miles(origin, destination) < 0.2:
        return {"miles": 0.0, "minutes": 0.0, "path": [list(origin)], "path_miles": [0.0], "directions": []}

    coords = f"{origin[1]},{origin[0]};{destination[1]},{destination[0]}"
    data = _get(
        f"{OSRM_URL}/route/v1/driving/{coords}",
        {"overview": "full", "geometries": "geojson", "steps": "true"},
    )
    if data.get("code") != "Ok" or not data.get("routes"):
        raise RoutingError("No drivable route was found between those locations.")

    route = data["routes"][0]
    miles = route["distance"] / METERS_PER_MILE
    # OSRM times are for cars; never let a truck average more than 65 mph.
    minutes = max(route["duration"] / 60, miles / MAX_TRUCK_MPH * 60)

    path = [[lat, lng] for lng, lat in route["geometry"]["coordinates"]]
    stride = max(1, math.ceil(len(path) / MAX_ROUTE_POINTS))
    path = path[::stride] + ([path[-1]] if (len(path) - 1) % stride else [])

    measured = [0.0]
    for previous, point in zip(path, path[1:]):
        measured.append(measured[-1] + haversine_miles(previous, point))
    scale = miles / measured[-1] if measured[-1] else 0
    path_miles = [m * scale for m in measured]

    return {
        "miles": miles,
        "minutes": minutes,
        "path": path,
        "path_miles": path_miles,
        "directions": _directions(route["legs"][0]["steps"]),
    }


def point_at(leg, miles):
    """The [lat, lng] reached after driving `miles` along a leg."""
    path, path_miles = leg["path"], leg["path_miles"]
    if miles <= 0:
        return path[0]
    if miles >= path_miles[-1]:
        return path[-1]
    low, high = 0, len(path_miles) - 1
    while high - low > 1:
        mid = (low + high) // 2
        if path_miles[mid] <= miles:
            low = mid
        else:
            high = mid
    span = path_miles[high] - path_miles[low]
    ratio = (miles - path_miles[low]) / span if span else 0
    return [
        path[low][0] + (path[high][0] - path[low][0]) * ratio,
        path[low][1] + (path[high][1] - path[low][1]) * ratio,
    ]
