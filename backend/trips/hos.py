"""
Hours-of-Service (HOS) trip scheduler.

Pure Python, no Django and no network. Given the driving legs of a trip it
produces a minute-by-minute duty-status timeline that respects the FMCSA rules
for a property-carrying driver on the 70-hour / 8-day cycle (49 CFR 395.3):

* 11-hour driving limit after 10 consecutive hours off duty
* 14-hour driving window, counted from the moment the driver starts any work
* 30-minute break after 8 cumulative hours of driving
* 70 hours on duty in 8 days, cleared by a 34-hour restart
* a fuel stop at least once every 1,000 miles
* 1 hour on duty (not driving) for pickup and for drop-off

All times are integer minutes counted from midnight of the first day, in the
driver's home-terminal time. Everything is kept on 15-minute marks, the same
resolution a paper log grid has.
"""

import math

OFF = "off_duty"
SLEEPER = "sleeper"
DRIVING = "driving"
ON_DUTY = "on_duty"

QUANTUM = 15  # minutes; the smallest step on a paper log grid
DAY = 24 * 60

MAX_DRIVING = 11 * 60
DRIVING_WINDOW = 14 * 60
BREAK_AFTER_DRIVING = 8 * 60
CYCLE_LIMIT = 70 * 60

DAILY_REST = 10 * 60
RESTART = 34 * 60
BREAK = 30
FUEL_STOP = 30
PICKUP = 60
DROPOFF = 60
PRE_TRIP = 15
FUEL_EVERY_MILES = 1000


def _floor_q(minutes):
    return int(minutes // QUANTUM) * QUANTUM


def _ceil_q(minutes):
    return int(math.ceil(minutes / QUANTUM - 1e-9)) * QUANTUM


class _Planner:
    def __init__(self, cycle_used_min, start_min):
        self.t = 0
        self.segments = []
        # Daily clocks. The driver is assumed to start the trip fully rested.
        self.shift_driving = 0
        self.window_start = None  # None means no shift is open
        self.driving_since_break = 0
        self.nondriving_streak = 0
        self.rest_streak = 0
        # Weekly clock.
        self.cycle = cycle_used_min
        # Position.
        self.miles = 0.0
        self.miles_since_fuel = 0.0
        self.leg = 0
        self.leg_miles = 0.0

        if start_min:
            self._add(OFF, start_min, "pre", "Off duty")

    def _add(self, status, minutes, kind, note, miles=0.0):
        seg = {
            "status": status,
            "kind": kind,
            "note": note,
            "start": self.t,
            "end": self.t + minutes,
            "leg": self.leg,
            "leg_miles_start": self.leg_miles,
            "leg_miles_end": self.leg_miles + miles,
            "miles_start": self.miles,
            "miles_end": self.miles + miles,
            "cycle_before": self.cycle,
        }
        self.t += minutes
        self.miles += miles
        self.leg_miles += miles
        self.miles_since_fuel += miles

        if status in (DRIVING, ON_DUTY):
            self.cycle += minutes
            self.rest_streak = 0
            if self.window_start is None:
                self.window_start = seg["start"]
        else:
            self.rest_streak += minutes
            if self.rest_streak >= DAILY_REST:
                self.shift_driving = 0
                self.window_start = None
            if self.rest_streak >= RESTART:
                self.cycle = 0

        if status == DRIVING:
            self.shift_driving += minutes
            self.driving_since_break += minutes
            self.nondriving_streak = 0
        else:
            # Any 30 consecutive minutes without driving counts as the break,
            # whether on duty, off duty or in the sleeper berth.
            self.nondriving_streak += minutes
            if self.nondriving_streak >= BREAK:
                self.driving_since_break = 0

        seg["cycle_after"] = self.cycle
        self.segments.append(seg)

    def _start_shift(self):
        if CYCLE_LIMIT - self.cycle < PRE_TRIP + QUANTUM:
            self._add(OFF, RESTART, "restart", "34-hour restart")
        self._add(ON_DUTY, PRE_TRIP, "pretrip", "Pre-trip inspection")

    def drive(self, leg_index, miles, minutes):
        self.leg = leg_index
        self.leg_miles = 0.0
        if minutes <= 0:
            return
        miles_per_min = miles / minutes
        remaining = minutes
        while remaining > 0:
            if self.window_start is None:
                self._start_shift()
            # Listed in priority order: on a tie the first one wins, so a
            # needed 10-hour rest is never preceded by a pointless short break.
            limits = [
                ("cycle", CYCLE_LIMIT - self.cycle),
                ("driving", MAX_DRIVING - self.shift_driving),
                ("window", self.window_start + DRIVING_WINDOW - self.t),
                ("fuel", _floor_q((FUEL_EVERY_MILES - self.miles_since_fuel) / miles_per_min)),
                ("break", BREAK_AFTER_DRIVING - self.driving_since_break),
            ]
            reason, limit = min(limits, key=lambda item: item[1])
            if limit <= 0:
                self._stop_for(reason)
                continue
            chunk = min(remaining, limit)
            remaining -= chunk
            chunk_miles = chunk * miles_per_min
            if remaining == 0:
                chunk_miles = miles - self.leg_miles  # land exactly on the leg end
            self._add(DRIVING, chunk, "drive", "Driving", miles=chunk_miles)

    def _stop_for(self, reason):
        if reason == "cycle":
            self._add(OFF, RESTART, "restart", "34-hour restart")
        elif reason in ("driving", "window"):
            self._add(SLEEPER, DAILY_REST, "rest", "10-hour rest")
        elif reason == "fuel":
            self._add(ON_DUTY, FUEL_STOP, "fuel", "Fuel stop")
            self.miles_since_fuel = 0.0
        else:
            self._add(OFF, BREAK, "break", "30-minute break")

    def work(self, minutes, kind, note):
        """On-duty, not-driving work. Allowed even past the 14-hour window."""
        if self.window_start is None:
            self._start_shift()
        self._add(ON_DUTY, minutes, kind, note)

    def finish(self):
        tail = -self.t % DAY
        if tail:
            self._add(OFF, tail, "post", "Off duty")


def plan_trip(legs, cycle_used_hours, start_minute):
    """
    legs: [(miles, driving_minutes)] -- current->pickup, then pickup->dropoff.
    cycle_used_hours: on-duty hours already used in the current 8-day cycle.
    start_minute: minute of the first day at which the driver comes on duty.

    Returns the list of duty-status segments covering whole days.
    """
    if not 0 <= cycle_used_hours <= 70:
        raise ValueError("Current cycle used must be between 0 and 70 hours.")

    planner = _Planner(_ceil_q(cycle_used_hours * 60), _ceil_q(start_minute) % DAY)
    to_pickup, to_dropoff = legs

    planner.drive(0, to_pickup[0], _ceil_q(to_pickup[1]))
    planner.work(PICKUP, "pickup", "Pickup")
    planner.drive(1, to_dropoff[0], _ceil_q(to_dropoff[1]))
    planner.work(DROPOFF, "dropoff", "Drop-off")
    planner.finish()
    return planner.segments


def _cycle_at(segments, minute):
    for seg in segments:
        if seg["start"] <= minute <= seg["end"]:
            if seg["status"] in (DRIVING, ON_DUTY):
                return seg["cycle_before"] + (minute - seg["start"])
            return seg["cycle_after"] if minute >= seg["end"] else seg["cycle_before"]
    return segments[-1]["cycle_after"]


def _miles_at(segments, minute):
    for seg in segments:
        if seg["start"] <= minute <= seg["end"]:
            share = (minute - seg["start"]) / (seg["end"] - seg["start"])
            return seg["miles_start"] + (seg["miles_end"] - seg["miles_start"]) * share
    return segments[-1]["miles_end"]


def build_days(segments):
    """Cut the timeline at each midnight into one log sheet per day."""
    days = []
    for index in range(segments[-1]["end"] // DAY):
        day_start, day_end = index * DAY, (index + 1) * DAY
        pieces = []
        totals = {OFF: 0, SLEEPER: 0, DRIVING: 0, ON_DUTY: 0}
        for seg in segments:
            start, end = max(seg["start"], day_start), min(seg["end"], day_end)
            if start >= end:
                continue
            totals[seg["status"]] += end - start
            pieces.append({
                "status": seg["status"],
                "kind": seg["kind"],
                "note": seg["note"],
                "location": seg.get("location", ""),
                "start": start - day_start,
                "end": end - day_start,
                "continued": seg["start"] < day_start,
            })
        cycle_used = _cycle_at(segments, day_end)
        days.append({
            "index": index,
            "segments": pieces,
            "totals": totals,
            # Rounded odometer readings, so the daily miles add up to the trip total.
            "miles": round(_miles_at(segments, day_end)) - round(_miles_at(segments, day_start)),
            "from": pieces[0]["location"],
            "to": pieces[-1]["location"],
            "on_duty_today": totals[DRIVING] + totals[ON_DUTY],
            "cycle_used": cycle_used,
            "cycle_available": max(0, CYCLE_LIMIT - cycle_used),
        })
    return days
