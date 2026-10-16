"""Minimum commission for new merchant acceptance transactions."""
import math

MIN_MERCHANT_COMMISSION_RATE = 0.015
MIN_MERCHANT_COMMISSION_PERCENT = 1.5


def effective_merchant_rate(value, default=MIN_MERCHANT_COMMISSION_RATE):
    """Keep higher configured rates; floor legacy rates without rewriting history."""
    try:
        rate = float(value)
    except (TypeError, ValueError):
        rate = default
    if not math.isfinite(rate):
        rate = default
    return max(MIN_MERCHANT_COMMISSION_RATE, rate)


def effective_merchant_percent(value):
    try:
        rate = float(value) / 100
    except (TypeError, ValueError):
        rate = MIN_MERCHANT_COMMISSION_RATE
    return effective_merchant_rate(rate) * 100
