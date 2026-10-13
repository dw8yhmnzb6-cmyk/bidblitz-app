"""Read-only Fuel commercial offer comparison.

Pure quote math; no agreements, payouts, payment authorization or persistence.
Both models are alternatives, not cumulative commissions.
"""
from __future__ import annotations

from decimal import Decimal, InvalidOperation, ROUND_CEILING, ROUND_HALF_UP

from services.fuel_core import CommissionRule, CommissionType
from services.fuel_finance import money

LITER_Q = Decimal("0.001")
FOUR_DP = Decimal("0.0001")


def _decimal(value, name: str, *, positive: bool = False, max_value=None) -> Decimal:
    try:
        number = Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError) as exc:
        raise ValueError(f"{name} must be numeric") from exc
    if not number.is_finite() or (number <= 0 if positive else number < 0):
        raise ValueError(f"{name} must be {'positive' if positive else 'non-negative'} and finite")
    if max_value is not None and number > max_value:
        raise ValueError(f"{name} exceeds allowed range")
    return number


def preview_fuel_commercial_offer(
    *,
    monthly_turnover="100000",
    station_count="1",
    price_per_liter="2.20",
    percent_rate="0.20",
    cent_per_liter="0.50",
    average_ticket="50",
    psp_percent="0",
    psp_fixed="0",
    fee_basis="gross",
    vat_percent="19",
    payment_fee_owner="operator",
) -> dict:
    """Return bounded numeric quote assumptions without triggering financial action."""
    if fee_basis not in ("gross", "net"):
        raise ValueError("fee_basis must be gross or net")
    if payment_fee_owner not in ("operator", "bidblitz", "shared"):
        raise ValueError("invalid payment_fee_owner")

    stations_value = _decimal(station_count, "station_count", positive=True, max_value=Decimal("10000"))
    if stations_value != stations_value.to_integral_value():
        raise ValueError("station_count must be a whole number")
    stations = int(stations_value)
    turnover = _decimal(monthly_turnover, "monthly_turnover", max_value=Decimal("1000000000"))
    pump_price = _decimal(price_per_liter, "price_per_liter", positive=True, max_value=Decimal("100"))
    percent = _decimal(percent_rate, "percent_rate", max_value=Decimal("100"))
    cents = _decimal(cent_per_liter, "cent_per_liter", max_value=Decimal("1000"))
    ticket = _decimal(average_ticket, "average_ticket", positive=True, max_value=Decimal("1000000"))
    card_percent = _decimal(psp_percent, "psp_percent", max_value=Decimal("100"))
    card_fixed = _decimal(psp_fixed, "psp_fixed", max_value=Decimal("10000"))
    vat = _decimal(vat_percent, "vat_percent", max_value=Decimal("100"))

    volume = (turnover / pump_price).quantize(LITER_Q, rounding=ROUND_HALF_UP)
    fee_turnover = turnover if fee_basis == "gross" else turnover / (Decimal("1") + vat / Decimal("100"))
    transaction_count = int((turnover / ticket).to_integral_value(rounding=ROUND_CEILING)) if turnover else 0

    percentage_revenue = CommissionRule(CommissionType.PERCENTAGE, percentage=percent).calculate(
        gross_amount=fee_turnover, liters=volume
    )
    liter_revenue = CommissionRule(
        CommissionType.PER_LITER, per_liter=cents / Decimal("100")
    ).calculate(gross_amount=turnover, liters=volume)

    psp_cost = money(turnover * card_percent / Decimal("100") + transaction_count * card_fixed)
    if payment_fee_owner == "operator":
        bidblitz_psp_cost = Decimal("0.00")
    elif payment_fee_owner == "bidblitz":
        bidblitz_psp_cost = psp_cost
    else:
        bidblitz_psp_cost = money(psp_cost / Decimal("2"))

    break_even_percent = (
        (liter_revenue / fee_turnover * 100).quantize(FOUR_DP, rounding=ROUND_HALF_UP)
        if fee_turnover else Decimal("0")
    )
    break_even_cent = (
        (percentage_revenue / volume * 100).quantize(FOUR_DP, rounding=ROUND_HALF_UP)
        if volume else Decimal("0")
    )

    def _portfolio_model(commission: Decimal) -> dict:
        monthly = money(commission * stations)
        monthly_after_psp = money((commission - bidblitz_psp_cost) * stations)
        return {
            "monthly_commission_before_cost": str(monthly),
            "monthly_after_allocated_psp_cost": str(monthly_after_psp),
            "annual_commission_before_cost": str(money(monthly * 12)),
            "annual_after_allocated_psp_cost": str(money(monthly_after_psp * 12)),
        }

    return {
        "mode": "dev_quote_only",
        "station_count": stations,
        "portfolio_projection": {
            "assumption": "all_stations_have_identical_monthly_turnover_and_fee_terms",
            "monthly_turnover_gross": str(money(turnover * stations)),
            "monthly_liters": str(volume * stations),
            "monthly_transactions": transaction_count * stations,
            "monthly_psp_cost": str(money(psp_cost * stations)),
            "monthly_bidblitz_psp_cost": str(money(bidblitz_psp_cost * stations)),
            "percentage_model": _portfolio_model(percentage_revenue),
            "per_liter_model": _portfolio_model(liter_revenue),
        },
        "payments_enabled": False,
        "currency": "EUR",
        "monthly_turnover_gross": str(money(turnover)),
        "estimated_liters": str(volume),
        "estimated_transactions": transaction_count,
        "percentage_basis": fee_basis,
        "monthly_percentage_basis": str(money(fee_turnover)),
        "percentage_rate": str(percent),
        "cent_per_liter": str(cents),
        "payment_fee_owner": payment_fee_owner,
        "estimated_psp_cost": str(psp_cost),
        "bidblitz_psp_cost": str(bidblitz_psp_cost),
        "percentage_model": {
            "commission_before_cost": str(percentage_revenue),
            "after_allocated_psp_cost": str(money(percentage_revenue - bidblitz_psp_cost)),
        },
        "per_liter_model": {
            "commission_before_cost": str(liter_revenue),
            "after_allocated_psp_cost": str(money(liter_revenue - bidblitz_psp_cost)),
        },
        "break_even_percentage_rate": str(break_even_percent),
        "break_even_cents_per_liter": str(break_even_cent),
        "notice": "Illustrative gross-volume quote, not profit, settlement, tax advice or an agreed partner tariff.",
    }
