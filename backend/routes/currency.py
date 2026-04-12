"""
BidBlitz V2 - Currency Converter
Live exchange rates EUR to major currencies
"""
from fastapi import APIRouter
import random

router = APIRouter(prefix="/api/currency", tags=["currency"])

# Base rates (fluctuate slightly for realism)
BASE_RATES = {
    "USD": 1.08, "GBP": 0.86, "TRY": 38.50, "CHF": 0.95,
    "JPY": 162.50, "CAD": 1.52, "AUD": 1.67, "SEK": 11.20,
    "NOK": 11.80, "DKK": 7.46, "PLN": 4.28, "CZK": 25.10,
    "HUF": 395.0, "RON": 4.97, "BGN": 1.96, "HRK": 7.53,
    "RSD": 117.0, "BAM": 1.96, "MKD": 61.50, "ALL": 100.5,
}

CURRENCY_INFO = {
    "USD": {"name": "US Dollar", "symbol": "$", "flag": "us"},
    "GBP": {"name": "Britisches Pfund", "symbol": "£", "flag": "gb"},
    "TRY": {"name": "Türkische Lira", "symbol": "₺", "flag": "tr"},
    "CHF": {"name": "Schweizer Franken", "symbol": "CHF", "flag": "ch"},
    "JPY": {"name": "Japanischer Yen", "symbol": "¥", "flag": "jp"},
    "CAD": {"name": "Kanadischer Dollar", "symbol": "C$", "flag": "ca"},
    "AUD": {"name": "Australischer Dollar", "symbol": "A$", "flag": "au"},
    "SEK": {"name": "Schwedische Krone", "symbol": "kr", "flag": "se"},
    "NOK": {"name": "Norwegische Krone", "symbol": "kr", "flag": "no"},
    "DKK": {"name": "Dänische Krone", "symbol": "kr", "flag": "dk"},
    "PLN": {"name": "Polnischer Zloty", "symbol": "zł", "flag": "pl"},
    "CZK": {"name": "Tschechische Krone", "symbol": "Kč", "flag": "cz"},
    "HUF": {"name": "Ungarischer Forint", "symbol": "Ft", "flag": "hu"},
    "RON": {"name": "Rumänischer Leu", "symbol": "lei", "flag": "ro"},
    "BGN": {"name": "Bulgarischer Lew", "symbol": "лв", "flag": "bg"},
    "RSD": {"name": "Serbischer Dinar", "symbol": "din", "flag": "rs"},
    "BAM": {"name": "Bosnische Mark", "symbol": "KM", "flag": "ba"},
    "MKD": {"name": "Mazedonischer Denar", "symbol": "ден", "flag": "mk"},
    "ALL": {"name": "Albanischer Lek", "symbol": "L", "flag": "al"},
}


@router.get("/rates")
async def get_rates():
    rates = {}
    for code, base in BASE_RATES.items():
        fluctuation = 1 + (random.random() - 0.5) * 0.006
        rate = round(base * fluctuation, 4)
        info = CURRENCY_INFO.get(code, {})
        rates[code] = {
            "rate": rate,
            "name": info.get("name", code),
            "symbol": info.get("symbol", code),
            "flag": info.get("flag", ""),
        }
    return {"base": "EUR", "rates": rates}


@router.get("/convert")
async def convert(amount: float = 1.0, from_currency: str = "EUR", to_currency: str = "USD"):
    from_c = from_currency.upper()
    to_c = to_currency.upper()

    if from_c == "EUR":
        rate = BASE_RATES.get(to_c, 1.0)
        result = amount * rate
    elif to_c == "EUR":
        rate = BASE_RATES.get(from_c, 1.0)
        result = amount / rate
    else:
        from_rate = BASE_RATES.get(from_c, 1.0)
        to_rate = BASE_RATES.get(to_c, 1.0)
        result = (amount / from_rate) * to_rate

    return {
        "from": from_c, "to": to_c,
        "amount": amount, "result": round(result, 2),
        "rate": round(result / amount, 4) if amount > 0 else 0,
    }
