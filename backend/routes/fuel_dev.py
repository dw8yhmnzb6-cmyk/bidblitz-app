"""DEV-only public-safe Fuel simulator routes.

No external providers and no payment execution. These endpoints expose only
synthetic station data so Fuel.BidBlitz frontend can be developed safely.
"""
from __future__ import annotations

from decimal import Decimal

from fastapi import APIRouter, HTTPException, Query

from services.dkv_enterprise import CAPABILITY_STATUS as DKV_CAPABILITY_STATUS, PROFILE as DKV_PROFILE
from services.fuel_core import (
    FuelProduct, FuelPump, FuelStationRecord, Provider, PumpStatus,
    SimulatorCatalog, StationCapabilities,
)
from services.fuel_simulator_sessions import STORE as FUEL_SIM_STORE

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


@router.get("/providers/status")
async def provider_status():
    return {
        "providers": [
            {
                "provider": "simulator",
                "status": "active_dev",
                "station_discovery": "synthetic_only",
                "payments": "blocked",
            },
            {
                "provider": "dkv",
                "status": "onboarding_required",
                "enterprise_api": DKV_CAPABILITY_STATUS.enterprise_data_api,
                "multi_customer_platform": DKV_CAPABILITY_STATUS.multi_customer_platform,
                "public_sandbox": DKV_CAPABILITY_STATUS.public_sandbox,
                "pay_at_pump_api": DKV_CAPABILITY_STATUS.pay_at_pump_api,
                "revenue_share": DKV_CAPABILITY_STATUS.revenue_share,
                "split_settlement": DKV_CAPABILITY_STATUS.split_settlement,
                "monthly_api_price_eur": DKV_PROFILE.monthly_price_eur,
            },
        ]
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


@router.get("/admin/overview")
async def admin_overview():
    stations = CATALOG.list_stations("DE")
    provider_payload = (await provider_status())["providers"]
    total_pumps = sum(len(s.pumps) for s in stations)
    free_pumps = sum(1 for s in stations for p in s.pumps if p.status == PumpStatus.FREE)
    unavailable_pumps = sum(1 for s in stations for p in s.pumps if p.status in (PumpStatus.OUT_OF_ORDER, PumpStatus.OFFLINE))
    return {
        "mode": "simulator",
        "payments_enabled": False,
        "external_networks_enabled": False,
        "metrics": {
            "stations": len(stations),
            "pumps": total_pumps,
            "free_pumps": free_pumps,
            "unavailable_pumps": unavailable_pumps,
            "live_sessions": 0,
            "payment_failures": 0,
            "open_incidents": unavailable_pumps,
        },
        "providers": provider_payload,
        "incidents": [
            {
                "incident_id": f"fuel-dev-{p.pump_id}",
                "station_id": s.station_id,
                "station_name": s.name,
                "pump_id": p.pump_id,
                "severity": "high" if p.status == PumpStatus.OUT_OF_ORDER else "medium",
                "reason": p.status.value,
                "automatic_action": "mobile_payment_disabled_for_pump",
            }
            for s in stations for p in s.pumps
            if p.status in (PumpStatus.OUT_OF_ORDER, PumpStatus.OFFLINE)
        ],
    }


@router.get("/operator/overview")
async def operator_overview():
    stations = CATALOG.list_stations("DE")
    online = sum(1 for s in stations if any(p.status != PumpStatus.OFFLINE for p in s.pumps))
    return {
        "mode": "simulator",
        "payments_enabled": False,
        "operator": {"operator_id": "op-simulator", "name": "BidBlitz Fuel Simulator"},
        "metrics": {
            "stations": len(stations),
            "online_stations": online,
            "transactions_today": 0,
            "gross_today": "0.00",
            "bidblitz_commission_today": "0.00",
            "operator_net_today": "0.00",
            "currency": "EUR",
        },
        "stations": [
            {
                "station_id": s.station_id,
                "name": s.name,
                "pump_count": len(s.pumps),
                "available_pumps": sum(1 for p in s.pumps if p.status == PumpStatus.FREE),
                "status": "online" if any(p.status != PumpStatus.OFFLINE for p in s.pumps) else "offline",
            }
            for s in stations
        ],
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


@router.post("/simulator/sessions")
async def create_simulator_session(
    station_id: str = Query(..., min_length=1, max_length=150),
    pump_id: str = Query(..., min_length=1, max_length=150),
    fuel_code: str = Query(..., min_length=1, max_length=50),
):
    station = CATALOG.get_station(station_id)
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")
    pump = next((p for p in station.pumps if p.pump_id == pump_id), None)
    if not pump:
        raise HTTPException(status_code=404, detail="Pump not found")
    if pump.status != PumpStatus.FREE:
        raise HTTPException(status_code=409, detail="Pump is not available")
    if fuel_code not in pump.product_codes:
        raise HTTPException(status_code=409, detail="Fuel product unavailable at pump")
    product = next((p for p in station.products if p.code == fuel_code), None)
    if not product:
        raise HTTPException(status_code=404, detail="Fuel product not found")

    item = FUEL_SIM_STORE.create(
        station_id=station.station_id,
        station_name=station.name,
        operator_name="BidBlitz Fuel Simulator Operator",
        pump_id=pump.pump_id,
        pump_number=pump.number,
        fuel_code=product.code,
        fuel_name=product.name,
        unit_price=product.unit_price,
        currency=product.currency,
    )
    return item.payload()


@router.get("/simulator/sessions")
async def list_simulator_sessions():
    return {
        "simulated": True,
        "sessions": [item.payload() for item in FUEL_SIM_STORE.list()],
    }


@router.get("/simulator/sessions/{session_id}")
async def get_simulator_session(session_id: str):
    item = FUEL_SIM_STORE.get(session_id)
    if not item:
        raise HTTPException(status_code=404, detail="Session not found")
    return item.payload()


@router.post("/simulator/sessions/{session_id}/authorize")
async def authorize_simulator_session(session_id: str):
    try:
        return FUEL_SIM_STORE.authorize_demo(session_id).payload()
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Session not found") from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/simulator/sessions/{session_id}/start")
async def start_simulator_session(session_id: str):
    try:
        return FUEL_SIM_STORE.start_demo_fueling(session_id).payload()
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Session not found") from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/simulator/sessions/{session_id}/complete")
async def complete_simulator_session(
    session_id: str,
    demo_liters: Decimal = Query(Decimal("31.700"), gt=Decimal("0"), le=Decimal("150")),
):
    try:
        return FUEL_SIM_STORE.complete_demo_fueling(
            session_id,
            liters=demo_liters,
        ).payload()
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Session not found") from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.get("/simulator/sessions/{session_id}/receipt")
async def get_simulator_receipt(session_id: str):
    item = FUEL_SIM_STORE.get(session_id)
    if not item:
        raise HTTPException(status_code=404, detail="Session not found")
    if not item.receipt:
        raise HTTPException(status_code=409, detail="Receipt not available")
    receipt = item.receipt
    return {
        "simulated": True,
        "fiscal_document": False,
        "issuer_role": receipt.issuer_role,
        "receipt": {
            "receipt_id": receipt.receipt_id,
            "transaction_id": receipt.transaction_id,
            "station_name": receipt.station_name,
            "operator_name": receipt.operator_name,
            "pump_number": receipt.pump_number,
            "fuel_name": receipt.fuel_name,
            "unit_price": str(receipt.unit_price),
            "liters": str(receipt.liters),
            "gross_amount": str(receipt.gross_amount),
            "currency": receipt.currency,
        },
    }
