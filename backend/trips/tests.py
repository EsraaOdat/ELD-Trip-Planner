from django.test import SimpleTestCase

from . import hos
from .hos import DRIVING, OFF, ON_DUTY, SLEEPER


def check_compliance(test, segments):
    """Replays a timeline independently of the planner and asserts every rule."""
    shift_driving = 0
    window_start = None
    driving_since_break = 0
    nondriving = 0
    rest = 0
    miles_since_fuel = 0.0
    clock = 0

    for seg in segments:
        test.assertEqual(seg["start"], clock, "timeline must be contiguous")
        minutes = seg["end"] - seg["start"]
        test.assertGreater(minutes, 0)
        test.assertEqual(seg["start"] % 15, 0)
        clock = seg["end"]

        if seg["status"] in (OFF, SLEEPER):
            rest += minutes
            if rest >= 600:
                shift_driving, window_start = 0, None
        else:
            rest = 0
            if window_start is None:
                window_start = seg["start"]

        if seg["status"] == DRIVING:
            shift_driving += minutes
            driving_since_break += minutes
            nondriving = 0
            miles_since_fuel += seg["miles_end"] - seg["miles_start"]
            test.assertLessEqual(shift_driving, 11 * 60, "11-hour driving limit")
            test.assertLessEqual(seg["end"], window_start + 14 * 60, "14-hour window")
            test.assertLessEqual(driving_since_break, 8 * 60, "30-minute break rule")
            test.assertLessEqual(seg["cycle_after"], 70 * 60, "70-hour cycle")
            test.assertLessEqual(miles_since_fuel, 1000 + 1e-6, "fuel every 1,000 miles")
        else:
            nondriving += minutes
            if nondriving >= 30:
                driving_since_break = 0
            if seg["kind"] == "fuel":
                miles_since_fuel = 0.0

    test.assertEqual(clock % 1440, 0, "timeline must end at midnight")


class HosPlannerTests(SimpleTestCase):
    def plan(self, legs, cycle=0, start=6 * 60):
        segments = hos.plan_trip(legs, cycle, start)
        check_compliance(self, segments)
        return segments

    def kinds(self, segments):
        return [s["kind"] for s in segments]

    def test_short_trip_fits_in_one_day(self):
        segments = self.plan([(60, 60), (240, 240)])
        self.assertEqual(
            self.kinds(segments),
            ["pre", "pretrip", "drive", "pickup", "drive", "dropoff", "post"],
        )
        days = hos.build_days(segments)
        self.assertEqual(len(days), 1)
        self.assertEqual(days[0]["totals"][DRIVING], 300)
        self.assertEqual(days[0]["totals"][ON_DUTY], 135)
        self.assertEqual(days[0]["miles"], 300)

    def test_break_after_eight_hours_of_driving(self):
        segments = self.plan([(0, 0), (550, 600)])
        kinds = self.kinds(segments)
        self.assertIn("break", kinds)
        drive_before_break = segments[kinds.index("break") - 1]
        self.assertEqual(drive_before_break["end"] - drive_before_break["start"], 480)

    def test_pickup_hour_counts_as_the_break(self):
        # 5h drive, 1h pickup, 5h drive: never 8h of driving without a break.
        segments = self.plan([(300, 300), (300, 300)])
        self.assertNotIn("break", self.kinds(segments))

    def test_eleven_hour_limit_forces_ten_hour_rest(self):
        segments = self.plan([(0, 0), (900, 900)])
        rests = [s for s in segments if s["kind"] == "rest"]
        self.assertEqual(len(rests), 1)
        self.assertEqual(rests[0]["end"] - rests[0]["start"], 600)
        self.assertEqual(rests[0]["status"], SLEEPER)
        driven_before = sum(
            s["end"] - s["start"] for s in segments
            if s["status"] == DRIVING and s["end"] <= rests[0]["start"]
        )
        self.assertEqual(driven_before, 660)

    def test_fuel_stop_at_least_every_1000_miles(self):
        segments = self.plan([(100, 100), (2700, 2700)])
        self.assertEqual(self.kinds(segments).count("fuel"), 2)

    def test_cycle_limit_triggers_34_hour_restart(self):
        segments = self.plan([(100, 120), (600, 660)], cycle=65)
        restarts = [s for s in segments if s["kind"] == "restart"]
        self.assertEqual(len(restarts), 1)
        self.assertEqual(restarts[0]["end"] - restarts[0]["start"], 34 * 60)
        self.assertEqual(restarts[0]["cycle_before"], 70 * 60)
        self.assertEqual(restarts[0]["cycle_after"], 0)

    def test_exhausted_cycle_restarts_before_any_work(self):
        segments = self.plan([(50, 60), (50, 60)], cycle=70, start=0)
        self.assertEqual(self.kinds(segments)[:2], ["restart", "pretrip"])

    def test_cross_country_trip(self):
        segments = self.plan([(350, 360), (2800, 2700)], cycle=20, start=7 * 60 + 30)
        days = hos.build_days(segments)
        self.assertGreaterEqual(len(days), 5)
        for day in days:
            self.assertEqual(sum(day["totals"].values()), 1440)
        self.assertEqual(sum(d["miles"] for d in days), 3150)
        self.assertEqual(sum(d["totals"][DRIVING] for d in days), 360 + 2700)

    def test_many_trips_stay_compliant(self):
        for cycle in (0, 12.5, 40, 58, 69.75):
            for start in (0, 5 * 60, 13 * 60 + 15, 23 * 60 + 45):
                for legs in ([(0, 0), (20, 30)], [(480, 500), (1500, 1400)], [(1200, 1150), (3100, 2950)]):
                    self.plan(legs, cycle=cycle, start=start)

    def test_rejects_invalid_cycle_hours(self):
        with self.assertRaises(ValueError):
            hos.plan_trip([(1, 1), (1, 1)], 71, 0)
