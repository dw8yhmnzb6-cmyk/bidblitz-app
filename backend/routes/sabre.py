"""
BidBlitz V2 - Sabre GDS REST Endpoints
Live flight & hotel search powered by Sabre APIs.
Flights: Bargain Finder Max v4.4.0 (works with DEVCENTER credentials)
Hotels:  Hotel Availability v5.0.0 (requires paid content access)
"""
import logging
from datetime import datetime, date
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from services.sabre_client import sabre_client, SabreApiError, sabre_environment
from data.airports import search_airports, AIRPORTS

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/sabre", tags=["sabre"])


# ─────────────────────────────────────────────────────────
# MODELS
# ─────────────────────────────────────────────────────────
class FlightSearchRequest(BaseModel):
    origin: str = Field(..., min_length=3, max_length=3, description="IATA origin (e.g. JFK)")
    destination: str = Field(..., min_length=3, max_length=3, description="IATA destination (e.g. LAX)")
    departure_date: str = Field(..., description="YYYY-MM-DD")
    return_date: Optional[str] = Field(None, description="YYYY-MM-DD for roundtrip")
    adults: int = Field(1, ge=1, le=9)
    cabin: str = Field("Y", description="Y=Economy, W=PremEcon, C=Business, F=First")
    num_results: int = Field(20, ge=1, le=50)


class HotelSearchRequest(BaseModel):
    city_or_airport_code: str = Field(..., min_length=3, max_length=3)
    check_in: str = Field(..., description="YYYY-MM-DD")
    check_out: str = Field(..., description="YYYY-MM-DD")
    adults: int = Field(2, ge=1, le=9)
    children: int = Field(0, ge=0, le=8)
    rooms: int = Field(1, ge=1, le=5)
    currency: str = Field("EUR", min_length=3, max_length=3)
    num_results: int = Field(20, ge=1, le=100)


# ─────────────────────────────────────────────────────────
# FLIGHT SEARCH (BFM v4.4.0)
# ─────────────────────────────────────────────────────────
def _build_bfm_payload(req: FlightSearchRequest) -> dict:
    od_info = [{
        "RPH": "1",
        "DepartureDateTime": f"{req.departure_date}T10:00:00",
        "OriginLocation": {"LocationCode": req.origin.upper()},
        "DestinationLocation": {"LocationCode": req.destination.upper()},
        "TPA_Extensions": {"SegmentType": {"Code": "O"}},
    }]
    if req.return_date:
        od_info.append({
            "RPH": "2",
            "DepartureDateTime": f"{req.return_date}T10:00:00",
            "OriginLocation": {"LocationCode": req.destination.upper()},
            "DestinationLocation": {"LocationCode": req.origin.upper()},
            "TPA_Extensions": {"SegmentType": {"Code": "O"}},
        })

    return {
        "OTA_AirLowFareSearchRQ": {
            "Version": "4.4.0",
            "Target": "Production",
            "POS": {
                "Source": [{
                    "PseudoCityCode": "F9CE",
                    "RequestorID": {"Type": "1", "ID": "1", "CompanyName": {"Code": "TN"}},
                }]
            },
            "OriginDestinationInformation": od_info,
            "TravelPreferences": {
                "TPA_Extensions": {"NumTrips": {"Number": req.num_results}},
                "CabinPref": [{"Cabin": req.cabin, "PreferLevel": "Preferred"}],
            },
            "TravelerInfoSummary": {
                "AirTravelerAvail": [{
                    "PassengerTypeQuantity": [{"Code": "ADT", "Quantity": req.adults}]
                }]
            },
        }
    }


def _parse_bfm_response(raw: dict) -> List[dict]:
    """Flatten Sabre's BFM v4 response into simple itinerary objects."""
    out = []
    resp = raw.get("groupedItineraryResponse", {})
    if not resp:
        return out

    schedule_desc = {s["id"]: s for s in resp.get("scheduleDescs", [])}
    leg_desc = {leg["id"]: leg for leg in resp.get("legDescs", [])}

    for group in resp.get("itineraryGroups", []):
        leg_descriptions = group.get("groupDescription", {}).get("legDescriptions", [])
        for it in group.get("itineraries", [])[:50]:
            pricing = (it.get("pricingInformation") or [{}])[0].get("fare", {})
            total = pricing.get("totalFare", {})
            base = pricing.get("baseFare", {})

            # Build segments
            segments = []
            for leg_ref in it.get("legs", []):
                leg = leg_desc.get(leg_ref["ref"], {})
                for sched_ref in leg.get("schedules", []):
                    sched = schedule_desc.get(sched_ref["ref"], {})
                    carrier = sched.get("carrier", {})
                    dep = sched.get("departure", {})
                    arr = sched.get("arrival", {})
                    segments.append({
                        "flight_number": f"{carrier.get('marketing', '')}{carrier.get('marketingFlightNumber', '')}",
                        "airline": carrier.get("marketing"),
                        "operating_airline": carrier.get("operating"),
                        "from": dep.get("airport"),
                        "to": arr.get("airport"),
                        "departure": dep.get("time"),
                        "arrival": arr.get("time"),
                        "duration_min": sched.get("elapsedTime"),
                        "equipment": sched.get("equipment", {}).get("code"),
                        "stops": len(sched.get("stopAirports") or []),
                    })

            out.append({
                "id": str(it.get("id")),
                "total_fare": float(total.get("totalPrice", 0) or 0),
                "base_fare": float(base.get("amount", 0) or 0),
                "currency": total.get("currency", "USD"),
                "validating_carrier": pricing.get("validatingCarrierCode"),
                "refundable": not pricing.get("passengerInfoList", [{}])[0]
                    .get("passengerInfo", {}).get("nonRefundable", True),
                "segments": segments,
                "num_stops": max(0, len(segments) - len(leg_descriptions)),
                "from": leg_descriptions[0].get("departureLocation") if leg_descriptions else None,
                "to": leg_descriptions[0].get("arrivalLocation") if leg_descriptions else None,
                "departure_date": leg_descriptions[0].get("departureDate") if leg_descriptions else None,
            })
    # Sort by price ascending
    out.sort(key=lambda x: x["total_fare"] if x["total_fare"] > 0 else float("inf"))
    return out


@router.get("/status")
async def sabre_status():
    """Verify Sabre connectivity."""
    try:
        token = await sabre_client.get_token()
        return {
            "ok": True,
            "environment": sabre_environment(),
            "token_preview": token[:20] + "...",
        }
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Sabre unreachable: {e}")


@router.get("/airports/search")
async def airports_search(q: str = Query("", description="Search query (city name, IATA code, country)"),
                           limit: int = Query(12, ge=1, le=50)):
    """Autocomplete airport/city search (works with just 2+ characters)."""
    if len(q.strip()) < 2:
        # Return popular airports as default
        popular = ["FRA", "MUC", "BER", "HAM", "VIE", "ZRH", "PRN", "TIA", "IST", "DXB",
                   "JFK", "LAX", "LHR", "CDG", "AMS", "MAD", "BCN", "FCO"]
        return {
            "ok": True,
            "airports": [a for a in AIRPORTS if a["code"] in popular][:limit],
        }
    return {"ok": True, "airports": search_airports(q, limit)}


@router.post("/flights/search")
async def search_flights(req: FlightSearchRequest):
    """Live flight search via Sabre Bargain Finder Max v4.4.0."""
    try:
        # Validate date
        dep = datetime.strptime(req.departure_date, "%Y-%m-%d").date()
        if dep < date.today():
            raise HTTPException(status_code=400, detail="departure_date darf nicht in der Vergangenheit liegen")
        if req.return_date:
            ret = datetime.strptime(req.return_date, "%Y-%m-%d").date()
            if ret < dep:
                raise HTTPException(status_code=400, detail="return_date muss nach departure_date liegen")
    except ValueError:
        raise HTTPException(status_code=400, detail="Ungültiges Datum (Format: YYYY-MM-DD)")

    payload = _build_bfm_payload(req)

    try:
        raw = await sabre_client.post("/v4.4.0/shop/flights", payload, query={"mode": "live"})
    except SabreApiError as e:
        logger.error("Sabre BFM error: %s", e)
        # Surface meaningful error
        body = e.body if isinstance(e.body, dict) else {}
        return {
            "ok": False,
            "error": body.get("errorCode", "UNKNOWN"),
            "message": body.get("message", str(e)),
            "flights": [],
        }
    except Exception as e:
        logger.exception("Sabre flight search failed")
        raise HTTPException(status_code=502, detail=f"Sabre Verbindungsfehler: {e}")

    # Check for error in payload
    if raw.get("status") and raw.get("status") != "Complete":
        # Merge error messages
        add_msgs = raw.get("additionalMessages") or []
        return {
            "ok": False,
            "error": raw.get("errorCode"),
            "message": raw.get("message"),
            "details": add_msgs,
            "flights": [],
        }

    flights = _parse_bfm_response(raw)
    return {
        "ok": True,
        "environment": sabre_environment(),
        "request": req.model_dump(),
        "count": len(flights),
        "flights": flights[: req.num_results],
    }


@router.get("/flights/quick-search")
async def quick_search_flights(
    origin: str = Query(..., min_length=3, max_length=3),
    destination: str = Query(..., min_length=3, max_length=3),
    departure_date: str = Query(...),
    return_date: Optional[str] = Query(None),
    adults: int = Query(1, ge=1, le=9),
    cabin: str = Query("Y"),
):
    """GET-Variante (für einfache URL-Tests)."""
    req = FlightSearchRequest(
        origin=origin,
        destination=destination,
        departure_date=departure_date,
        return_date=return_date,
        adults=adults,
        cabin=cabin,
        num_results=15,
    )
    return await search_flights(req)


# ─────────────────────────────────────────────────────────
# HOTEL SEARCH (Hotel Avail v5.0.0 — requires content access)
# ─────────────────────────────────────────────────────────
@router.post("/hotels/search")
async def search_hotels(req: HotelSearchRequest):
    """Live hotel search via Sabre Hotel Availability API."""
    try:
        ci = datetime.strptime(req.check_in, "%Y-%m-%d").date()
        co = datetime.strptime(req.check_out, "%Y-%m-%d").date()
        if ci < date.today():
            raise HTTPException(status_code=400, detail="check_in darf nicht in der Vergangenheit liegen")
        if co <= ci:
            raise HTTPException(status_code=400, detail="check_out muss nach check_in liegen")
        nights = (co - ci).days
    except ValueError:
        raise HTTPException(status_code=400, detail="Ungültiges Datum (Format: YYYY-MM-DD)")

    adults_per_room = [req.adults] * req.rooms
    children_per_room = [req.children] * req.rooms

    payload = {
        "GetHotelAvailRQ": {
            "SearchCriteria": {
                "OffSet": 1,
                "SortBy": "TotalRate",
                "SortOrder": "ASC",
                "PageSize": req.num_results,
                "TierLabels": False,
                "GeoSearch": {
                    "GeoRef": {
                        "Radius": 25,
                        "UOM": "MI",
                        "RefPoint": {
                            "Value": req.city_or_airport_code.upper(),
                            "ValueContext": "CODE",
                            "RefPointType": "6",
                        },
                    }
                },
                "RateInfoRef": {
                    "ConvertedRateInfoOnly": False,
                    "CurrencyCode": req.currency.upper(),
                    "BestOnly": "2",
                    "PrepaidQualifier": "IncludePrepaid",
                    "InfoSource": "100,110,112,113",
                    "StayDateRange": {
                        "Duration": nights,
                        "StartDate": req.check_in,
                    },
                    "Rooms": {
                        "Room": [
                            {"Index": i + 1, "Adults": adults_per_room[i], "Children": children_per_room[i]}
                            for i in range(req.rooms)
                        ]
                    },
                },
            }
        }
    }

    try:
        raw = await sabre_client.post("/v5.0.0/hotels/search", payload)
    except SabreApiError as e:
        body = e.body if isinstance(e.body, dict) else {}
        code = body.get("errorCode", "")
        if "NOT_AUTHORIZED" in str(code):
            return {
                "ok": False,
                "error": "SABRE_HOTEL_CONTENT_NOT_AUTHORIZED",
                "message": (
                    "Die aktuellen Sabre-Zugangsdaten (DEVCENTER/CERT) haben keinen Zugriff "
                    "auf das Hotel-Content-API. Für Live-Hotel-Suche wird ein Sabre Hotel-Content-Paket "
                    "benötigt. Flüge funktionieren weiterhin."
                ),
                "hotels": [],
            }
        return {
            "ok": False,
            "error": body.get("errorCode", "UNKNOWN"),
            "message": body.get("message", str(e)),
            "hotels": [],
        }
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Sabre Verbindungsfehler: {e}")

    # Parse hotels from response
    hotels_raw = raw.get("GetHotelAvailRS", {}).get("HotelAvailInfoList", {}).get("HotelAvailInfo", [])
    hotels = []
    for h in hotels_raw[: req.num_results]:
        prop = h.get("HotelInfo", {})
        rate = (h.get("HotelRateInfo", {}).get("RateInfos", {}).get("ConvertedRateInfo") or [{}])[0]
        hotels.append({
            "code": prop.get("HotelCode"),
            "name": prop.get("HotelName"),
            "chain": prop.get("ChainCode"),
            "address": prop.get("LocationInfo", {}).get("Address", {}).get("AddressLine1"),
            "city": prop.get("LocationInfo", {}).get("Address", {}).get("CityName"),
            "country": prop.get("LocationInfo", {}).get("Address", {}).get("CountryCode"),
            "rating": prop.get("SabreRating"),
            "lat": prop.get("LocationInfo", {}).get("Latitude"),
            "lng": prop.get("LocationInfo", {}).get("Longitude"),
            "total_price": float(rate.get("AmountAfterTax", 0) or 0),
            "currency": rate.get("CurrencyCode", req.currency.upper()),
        })

    return {
        "ok": True,
        "environment": sabre_environment(),
        "request": req.model_dump(),
        "count": len(hotels),
        "hotels": hotels,
    }
