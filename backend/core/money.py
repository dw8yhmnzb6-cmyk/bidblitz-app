from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP

MINOR_FACTOR = Decimal("100")


def to_minor(amount_major: float | int | str | Decimal | None) -> int:
    value = Decimal(str(amount_major or 0))
    return int((value * MINOR_FACTOR).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def from_minor(amount_minor: int | float | str | Decimal | None) -> float:
    value = Decimal(str(amount_minor or 0))
    return float((value / MINOR_FACTOR).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def add_minor(*values: int | float | str | Decimal | None) -> int:
    total = Decimal("0")
    for value in values:
        total += Decimal(str(int(value or 0)))
    return int(total)


def basis_points_fee(amount_minor: int, basis_points: int) -> int:
    amount = Decimal(str(int(amount_minor or 0)))
    bps = Decimal(str(int(basis_points or 0)))
    return int((amount * bps / Decimal("10000")).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def clamp_minor(amount_minor: int, minimum: int = 0) -> int:
    return max(int(amount_minor or 0), int(minimum or 0))


def minor_to_display(amount_minor: int) -> str:
    return f"{from_minor(amount_minor):.2f}"