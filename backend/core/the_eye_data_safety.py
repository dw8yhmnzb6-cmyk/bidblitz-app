"""Data classification and recursive secret redaction for The Eye."""

from __future__ import annotations

import re
from typing import Any, Dict, Literal, Mapping, Sequence


DataClassification = Literal[
    "public",
    "internal",
    "confidential",
    "sensitive",
    "restricted",
]

REDACTED = "[REDACTED]"

_RESTRICTED_EXACT = frozenset({
    "password",
    "password_hash",
    "passwd",
    "pwd",
    "token",
    "token_hash",
    "access_token",
    "refresh_token",
    "device_token",
    "connector_token",
    "session_token",
    "api_key",
    "api_secret",
    "client_secret",
    "private_key",
    "credentials",
    "authorization",
    "cookie",
    "set_cookie",
    "rtsp_url",
})


_SENSITIVE_EXACT = frozenset({
    "email",
    "phone",
    "source_ip",
    "ip_address",
    "lat",
    "lng",
    "location",
    "address",
})

_CONFIDENTIAL_EXACT = frozenset({
    "metadata",
    "payload",
    "details",
    "before",
    "after",
    "result",
})


def _normalize_key(key: Any) -> str:
    text = str(key or "").strip().lower()
    text = re.sub(r"[^a-z0-9]+", "_", text)
    return text.strip("_")


def classify_the_eye_field(key: Any) -> DataClassification:
    normalized = _normalize_key(key)
    if (
        normalized in _RESTRICTED_EXACT
        or "password" in normalized
        or "credential" in normalized
        or "private_key" in normalized
        or normalized.endswith("_secret")
        or normalized.endswith("_token")
    ):
        return "restricted"
    if normalized in _SENSITIVE_EXACT:
        return "sensitive"
    if normalized in _CONFIDENTIAL_EXACT:
        return "confidential"
    return "internal"


def sanitize_the_eye_payload(value: Any, *, _depth: int = 0) -> Any:
    """Return a JSON-safe copy with restricted fields recursively redacted."""
    if _depth > 20:
        return "[TRUNCATED]"

    if isinstance(value, Mapping):
        sanitized: Dict[str, Any] = {}
        for key, item in value.items():
            key_text = str(key)
            if classify_the_eye_field(key_text) == "restricted":
                sanitized[key_text] = REDACTED
            else:
                sanitized[key_text] = sanitize_the_eye_payload(
                    item,
                    _depth=_depth + 1,
                )
        return sanitized

    if isinstance(value, (list, tuple, set, frozenset)):
        return [
            sanitize_the_eye_payload(item, _depth=_depth + 1)
            for item in value
        ]

    return value


def safe_the_eye_document(
    document: Mapping[str, Any],
    *,
    drop_keys: Sequence[str] = (),
) -> Dict[str, Any]:
    safe = sanitize_the_eye_payload(document)
    if not isinstance(safe, dict):
        return {}
    for key in drop_keys:
        safe.pop(str(key), None)
    return safe
