"""ParkZen lot data processing, with the ParkZen API replaced by fixed responses."""
import pytest
from fastapi import HTTPException

import app.main as main

PERMIT_NAMES = {"p1": "Eagle", "p2": "Faculty and Staff", "p3": "Evening"}


@pytest.fixture
def parkzen(monkeypatch):
    """Serves `lots` as ParkZen's lot list; permit ids resolve through PERMIT_NAMES."""
    lots = []

    async def fake_fetch():
        return lots, "token"

    async def fake_permit_info(permit_id, token):
        name = PERMIT_NAMES.get(permit_id)
        return {"name": name, "type": None, "dailyTimeSlots": []} if name else None

    monkeypatch.setattr(main, "_fetch_raw_lots", fake_fetch)
    monkeypatch.setattr(main, "get_permit_info", fake_permit_info)
    return lots


def lot(name, estimate=None, permits=("p1",), **extra):
    occupancy = {} if estimate is None else {"parkzenServerOccupancyEstimate": estimate}
    return {"name": name, "permits": list(permits), "occupancy": occupancy, **extra}


@pytest.mark.parametrize("estimate,title,color", [
    (0.5, "Available", "#2ECC71"),
    (0.85, "Medium", "#F39C12"),
    (0.95, "Full", "#E74C3C"),
    (None, "No Data", "#808080"),
])
def test_occupancy_sets_status_and_color(client, parkzen, estimate, title, color):
    parkzen.append(lot("Lot 20", estimate))
    result = client.get("/api/lots").json()[0]
    assert (result["infoSheetTitle"], result["fillColor"]) == (title, color)


def test_permit_ids_become_names(client, parkzen):
    parkzen.append(lot("Lot 20", 0.5, permits=["p1", "p2", "unknown"]))
    assert client.get("/api/lots").json()[0]["permits"] == ["Eagle", "Faculty and Staff", "Unknown"]


def test_timestamps_are_normalized_to_utc(client, parkzen):
    parkzen.append(lot("Lot 20", 0.5, lastUpdatedAt=1_762_700_000_000))
    parkzen.append(lot("Lot 24", 0.5, updatedAt="2026-11-09T15:00:00Z"))
    first, second = client.get("/api/lots").json()
    assert first["lastUpdatedAt"].endswith("+00:00")
    assert second["lastUpdatedAt"] == "2026-11-09T15:00:00+00:00"
    assert second["captureTimeSource"] == "parkzen"


def test_permit_list_is_distinct_and_sorted(client, parkzen):
    parkzen.extend([lot("Lot 20", permits=["p2", "p1"]), lot("Lot 24", permits=["p1", "p3"])])
    assert client.get("/api/permits").json() == ["Eagle", "Evening", "Faculty and Staff"]


def test_parkzen_outage_returns_a_clean_error(client, monkeypatch):
    async def down():
        raise HTTPException(status_code=401, detail="Failed to authenticate with ParkZen")

    monkeypatch.setattr(main, "_fetch_raw_lots", down)
    assert client.get("/api/permits").status_code == 401
    assert client.get("/api/lots").status_code == 500
