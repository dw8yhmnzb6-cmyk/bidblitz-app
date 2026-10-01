"""Consistent fact/inference formatting for The Eye root-cause analysis."""

from __future__ import annotations

from typing import Iterable, Optional


_RECOMMENDED_CHECKS = {
    "upstream_network": [
        "Check router/WAN/modem power and link state.",
        "Check upstream carrier/uplink status and recent network changes.",
    ],
    "poe_switch": [
        "Check PoE switch power, uplink/SFP and port state.",
        "Check PoE budget and affected camera ports.",
    ],
    "power_instability": [
        "Check mains input, UPS battery/runtime and downstream power distribution.",
        "Check for recent power events or unstable supply.",
    ],
    "camera_or_local_link": [
        "Check camera power, cable/link and local switch port.",
        "Check camera health and whether the fault is isolated to one endpoint.",
    ],
}


def build_root_cause_assessment(
    classification: Optional[str],
    confidence: Optional[float],
    evidence: Iterable[str] | None,
    recommended_checks: Iterable[str] | None = None,
) -> Optional[dict]:
    if not classification:
        return None

    facts = [str(item) for item in (evidence or []) if str(item).strip()]
    checks = [
        str(item)
        for item in (
            list(recommended_checks or [])
            or _RECOMMENDED_CHECKS.get(str(classification), [])
        )
        if str(item).strip()
    ]
    normalized_confidence = (
        max(0.0, min(float(confidence), 1.0))
        if confidence is not None
        else None
    )

    return {
        "fact": facts,
        "likely_cause": str(classification),
        "confidence": normalized_confidence,
        "recommended_check": checks,
        # Backward-compatible aliases for existing clients.
        "classification": str(classification),
        "evidence": facts,
    }
