from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta

from rest_framework.decorators import api_view
from rest_framework.response import Response

from . import hos, routing
from .serializers import TripRequestSerializer

STOP_KINDS = {"pickup", "dropoff", "fuel", "break", "rest", "restart"}


@api_view(["GET"])
def health(request):
    return Response({"status": "ok"})


@api_view(["GET"])
def geocode(request):
    query = request.query_params.get("q", "").strip()
    if len(query) < 3:
        return Response([])
    try:
        return Response(routing.geocode(query))
    except routing.RoutingError as exc:
        return Response({"detail": str(exc)}, status=502)


def _resolve(location, field):
    """A location arrives with coordinates (picked from suggestions) or as plain text."""
    if location.get("lat") is not None and location.get("lng") is not None:
        return location["lat"], location["lng"]
    matches = routing.geocode(location["label"], limit=1)
    if not matches:
        raise ValueError(f"Could not find the {field} \"{location['label']}\".")
    return matches[0]["lat"], matches[0]["lng"]


@api_view(["POST"])
def plan_trip(request):
    serializer = TripRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data

    places = [
        (data["current_location"], "current location"),
        (data["pickup_location"], "pickup location"),
        (data["dropoff_location"], "dropoff location"),
    ]
    try:
        with ThreadPoolExecutor(max_workers=3) as pool:
            current, pickup, dropoff = pool.map(lambda place: _resolve(*place), places)
            legs = list(pool.map(lambda pair: routing.route_leg(*pair), [(current, pickup), (pickup, dropoff)]))
    except ValueError as exc:
        return Response({"detail": str(exc)}, status=400)
    except routing.RoutingError as exc:
        return Response({"detail": str(exc)}, status=502)

    start = data["start_time"].replace(tzinfo=None)
    midnight = start.replace(hour=0, minute=0, second=0, microsecond=0)
    start_minute = (start - midnight).total_seconds() / 60

    segments = hos.plan_trip(
        [(leg["miles"], leg["minutes"]) for leg in legs],
        data["current_cycle_used"],
        start_minute,
    )

    # Where each duty-status change happens, then its "City, ST" for the Remarks.
    for seg in segments:
        lat, lng = routing.point_at(legs[seg["leg"]], seg["leg_miles_start"])
        seg["lat"], seg["lng"] = round(lat, 4), round(lng, 4)
        seg["location"] = routing.nearest_city(lat, lng)

    def clock(minute):
        return (midnight + timedelta(minutes=minute)).isoformat(timespec="minutes")

    timeline = [
        {
            "status": seg["status"],
            "kind": seg["kind"],
            "note": seg["note"],
            "location": seg["location"],
            "lat": seg["lat"],
            "lng": seg["lng"],
            "start": clock(seg["start"]),
            "end": clock(seg["end"]),
            "minutes": seg["end"] - seg["start"],
            "miles": round(seg["miles_end"] - seg["miles_start"]),
            "mile_marker": round(seg["miles_start"]),
        }
        for seg in segments
        if seg["kind"] not in ("pre", "post")
    ]

    days = hos.build_days(segments)
    for day in days:
        day["date"] = (midnight + timedelta(days=day["index"])).date().isoformat()

    working = [s for s in segments if s["kind"] not in ("pre", "post")]
    total = lambda status: sum(s["end"] - s["start"] for s in segments if s["status"] == status)

    return Response({
        "locations": {
            "current": {"label": timeline[0]["location"], "lat": current[0], "lng": current[1]},
            "pickup": {"label": names_for(timeline, "pickup"), "lat": pickup[0], "lng": pickup[1]},
            "dropoff": {"label": names_for(timeline, "dropoff"), "lat": dropoff[0], "lng": dropoff[1]},
        },
        "legs": [
            {
                "name": name,
                "miles": round(leg["miles"]),
                "driving_minutes": hos._ceil_q(leg["minutes"]),
                "path": [[round(lat, 5), round(lng, 5)] for lat, lng in leg["path"]],
                "directions": leg["directions"],
            }
            for name, leg in zip(("To pickup", "To drop-off"), legs)
        ],
        "summary": {
            "total_miles": round(sum(leg["miles"] for leg in legs)),
            "driving_minutes": total(hos.DRIVING),
            "on_duty_minutes": total(hos.ON_DUTY),
            "trip_minutes": working[-1]["end"] - working[0]["start"],
            "departure": clock(working[0]["start"]),
            "arrival": clock(working[-1]["end"]),
            "days": len(days),
            "stops": {kind: sum(1 for s in segments if s["kind"] == kind) for kind in ("fuel", "break", "rest", "restart")},
            "cycle_used_start": hos._ceil_q(data["current_cycle_used"] * 60),
            "cycle_used_end": segments[-1]["cycle_after"],
        },
        "stops": [event for event in timeline if event["kind"] in STOP_KINDS],
        "timeline": timeline,
        "days": days,
    })


def names_for(timeline, kind):
    return next(event["location"] for event in timeline if event["kind"] == kind)
