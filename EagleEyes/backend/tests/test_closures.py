"""Lot closures: blocking hazard reports and warning admins about overlapping events."""
from datetime import datetime, timedelta, timezone

import pytest

NOW = datetime.now(timezone.utc)


def hours(n):
    return (NOW + timedelta(hours=n)).isoformat()


def event(client, headers, category, lots, start, end=None, title="Event"):
    body = {"title": title, "alert_type": "event", "category": category, "lot_name": lots, "event_start": start}
    if end:
        body["event_end"] = end
    return client.post("/alerts", headers=headers, json=body)


def hazard(client, headers, lot):
    return client.post("/alerts", headers=headers, json={
        "title": "Ice", "alert_type": "hazard", "category": "snow", "lot_name": lot,
    })


@pytest.fixture
def closure(client, admin):
    """Lot 20 and Lot 24 closed from an hour ago to three hours from now."""
    return event(client, admin, "Lot Closure", "Lot 20; Lot 24", hours(-1), hours(3), title="Gameday closure").json()


class TestHazardReportsOnClosedLots:
    def test_commuter_report_blocked(self, client, commuter, closure):
        response = hazard(client, commuter, "Lot 24")
        assert response.status_code == 409
        assert "closed" in response.json()["detail"]

    def test_lot_names_match_case_insensitively(self, client, commuter, closure):
        assert hazard(client, commuter, "lot 20").status_code == 409

    def test_open_lots_unaffected(self, client, commuter, closure):
        assert hazard(client, commuter, "Lot 50").status_code == 200

    def test_future_and_finished_closures_do_not_block(self, client, commuter, admin):
        event(client, admin, "Lot Closure", "Lot 30", hours(2), hours(4))
        event(client, admin, "Lot Closure", "Lot 31", hours(-4), hours(-2))
        assert hazard(client, commuter, "Lot 30").status_code == 200
        assert hazard(client, commuter, "Lot 31").status_code == 200

    def test_open_ended_and_legacy_closures_block(self, client, commuter, admin):
        event(client, admin, "Closure", "Lot 40", hours(-1))
        assert hazard(client, commuter, "Lot 40").status_code == 409

    def test_admin_can_post_with_a_warning(self, client, admin, closure):
        response = hazard(client, admin, "Lot 20")
        assert response.status_code == 200
        assert [c["id"] for c in response.json()["conflicts"]] == [closure["id"]]

    def test_approving_a_report_on_a_lot_that_closed_warns(self, client, commuter, admin):
        report = hazard(client, commuter, "Lot 50").json()
        closing = event(client, admin, "Lot Closure", "Lot 50", hours(-0.1)).json()
        approved = client.put(f"/alerts/{report['id']}/approve", headers=admin, json={}).json()
        assert [c["id"] for c in approved["conflicts"]] == [closing["id"]]


class TestEventConflicts:
    def test_event_overlapping_a_closure_is_flagged(self, client, admin, closure):
        response = event(client, admin, "Concert", "Lot 20", hours(2), hours(5)).json()
        assert [c["id"] for c in response["conflicts"]] == [closure["id"]]
        assert response["conflicts"][0]["lot_names"] == ["Lot 20"]

    def test_back_to_back_events_are_fine(self, client, admin, closure):
        assert event(client, admin, "Concert", "Lot 20", hours(3), hours(5)).json()["conflicts"] == []

    def test_regular_events_do_not_conflict_with_each_other(self, client, admin):
        event(client, admin, "Concert", "Lot 60", hours(1), hours(3))
        assert event(client, admin, "Gameday", "Lot 60", hours(2), hours(4)).json()["conflicts"] == []

    def test_new_closure_lists_booked_events(self, client, admin):
        concert = event(client, admin, "Concert", "Lot 60", hours(5), hours(8)).json()
        response = event(client, admin, "Lot Closure", "Lot 60", hours(4)).json()
        assert [c["id"] for c in response["conflicts"]] == [concert["id"]]

    def test_editing_an_event_ignores_itself(self, client, admin, closure):
        response = client.put(f"/alerts/{closure['id']}", headers=admin, json={
            "title": "Gameday closure", "category": "Lot Closure", "lot_name": "Lot 20; Lot 24",
            "event_start": hours(-1), "event_end": hours(4),
        })
        assert response.status_code == 200
        assert response.json()["conflicts"] == []

    def test_end_before_start_rejected(self, client, admin, closure):
        response = client.put(f"/alerts/{closure['id']}", headers=admin, json={
            "title": "x", "category": "Lot Closure", "event_start": hours(2), "event_end": hours(1),
        })
        assert response.status_code == 400
