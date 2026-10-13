"""DEV-only public-safe Fuel simulator routes.

No external providers and no payment execution. These endpoints expose only
synthetic station data so Fuel.BidBlitz frontend can be developed safely.
"""
from __future__ import annotations

from decimal import Decimal

from fastapi import APIRouter, HTTPException, Query

from services.fuel_core import (
    FuelProduct, FuelPump, FuelStationRecord, Provider, PumpStatus,
    SimulatorCatalog, StationCapabilities,
)

router = APIRouter(prefix="/api/fuel", tags=["fuel-dev"])


def _catalog() -> SimulatorCatalog:
    capabilities = StationCapabilities(
        mobile_payment=True,
        pump_status=True,
        pre_authorization=True,
        digital_receipt=True,
        refund=True,
        price_feed=True,
    )
    stations = [
        FuelStationRecord(
            station_id="sim-de-berlin-001",
            operator_id="op-simulator",
            provider=Provider.SIMULATOR,
            provider_station_id="berlin-001",
            name="BidBlitz Fuel Berlin Mitte",
            country="DE",
            capabilities=capabilities,
            pumps=(
                FuelPump("berlin-1", "1", PumpStatus.FREE, ("e10", "super", "diesel")),
                FuelPump("berlin-2", "2", PumpStatus.FUELING, ("e10", "diesel")),
                FuelPump("berlin-3", "3", PumpStatus.READY_TO_PAY, ("super", "diesel")),
                FuelPump("berlin-4", "4", PumpStatus.OUT_OF_ORDER, ("e10",)),
            ),
            products=(
                FuelProduct("e10", "Super E10", Decimal("1.629")),
                FuelProduct("super", "Super", Decimal("1.689")),
                FuelProduct("diesel", "Diesel", Decimal("1.579")),
            ),
        ),
        FuelStationRecord(
            station_id="sim-de-wuppertal-001",
            operator_id="op-simulator",
            provider=Provider.SIMULATOR,
            provider_station_id="wuppertal-001",
            name="BidBlitz Fuel Wuppertal",
            country="DE",
            capabilities=capabilities,
            pumps=(
                FuelPump("wuppertal-1", "1", PumpStatus.FREE, ("e10", "super", "diesel")),
                FuelPump("wuppertal-2", "2", PumpStatus.FREE, ("e10", "super", "diesel")),
                FuelPump("wuppertal-3", "3", PumpStatus.OFFLINE, ("diesel",)),
            ),
            products=(
                FuelProduct("e10", "Super E10", Decimal("1.619")),
                FuelProduct("super", "Super", Decimal("1.679")),
                FuelProduct("diesel", "Diesel", Decimal("1.569")),
            ),
        ),
    ]
    return SimulatorCatalog(stations)


CATALOG = _catalog()


def _station_payload(station: FuelStationRecord) -> dict:
    return {
        "station_id": station.station_id,
        "operator_id": station.operator_id,
        "provider": station.provider.value,
        "name": station.name,
        "country": station.country,
        "capabilities": {
            "mobile_payment": station.capabilities.mobile_payment,
            "pump_status": station.capabilities.pump_status,
            "pre_authorization": station.capabilities.pre_authorization,
            "digital_receipt": station.capabilities.digital_receipt,
            "refund": station.capabilities.refund,
            "price_feed": station.capabilities.price_feed,
            "remote_release": station.capabilities.remote_release,
        },
        "products": [
            {
                "code": p.code,
                "name": p.name,
                "unit_price": str(p.unit_price),
                "currency": p.currency,
            }
            for p in station.products
        ],
        "pumps": [
            {
                "pump_id": p.pump_id,
                "number": p.number,
                "status": p.status.value,
                "product_codes": list(p.product_codes),
            }
            for p in station.pumps
        ],
    }


@router.get("/status")
async def fuel_status():
    return {
        "status": "development",
        "payments_enabled": False,
        "external_networks_enabled": False,
        "provider": "simulator",
    }


@router.get("/stations")
async def list_fuel_stations(
    country: str = Query("DE", min_length=2, max_length=2),
):
    country = country.upper()
    try:
        stations = CATALOG.list_stations(country)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {
        "mode": "simulator",
        "payments_enabled": False,
        "stations": [_station_payload(s) for s in stations],
    }


@router.get("/stations/{station_id}")
async def get_fuel_station(station_id: str):
    station = CATALOG.get_station(station_id)
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")
    return {
        "mode": "simulator",
        "payments_enabled": False,
        "station": _station_payload(station),
    }


@router.post("/stations/{station_id}/pumps/{pump_id}/prepare")
async def prepare_fuel_session(station_id: str, pump_id: str):
    station = CATALOG.get_station(station_id)
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")
    pump = next((p for p in station.pumps if p.pump_id == pump_id), None)
    if not pump:
        raise HTTPException(status_code=404, detail="Pump not found")
    if pump.status != PumpStatus.FREE:
        raise HTTPException(status_code=409, detail="Pump is not available")
    return {
        "status": "blocked_until_payment_integration",
        "payments_enabled": False,
        "station_id": station.station_id,
        "pump_id": pump.pump_id,
        "message": "DEV simulator only. No payment authorization or pump release executed.",
    }
