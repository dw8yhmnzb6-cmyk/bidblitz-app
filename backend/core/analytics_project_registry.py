"""Trust boundary for the future first-party analytics collector.

Only server-configured sites may submit events. Never take authoritative
project identity from a browser body or an untrusted X-Forwarded-Host header.
This module is intentionally not wired to production routes.
"""
from urllib.parse import urlparse

class AnalyticsProjectRegistry:
    def __init__(self, entries):
        self._entries = {}
        for origin, project in entries.items():
            parsed = urlparse(origin)
            if parsed.scheme not in ("https", "http") or not parsed.hostname or parsed.username or parsed.password:
                raise ValueError("Invalid configured origin")
            if parsed.path or parsed.query or parsed.fragment or origin.endswith("/"):
                raise ValueError("Origin must not contain a path")
            key = (parsed.scheme, parsed.netloc.lower())
            if key in self._entries:
                raise ValueError("Duplicate origin")
            self._entries[key] = project

    def resolve(self, origin, request_host):
        parsed = urlparse(origin or "")
        if parsed.scheme not in ("https", "http") or parsed.path not in ("", "/"):
            raise ValueError("Invalid origin")
        if parsed.query or parsed.fragment or parsed.username or parsed.password:
            raise ValueError("Invalid origin")
        key = (parsed.scheme, parsed.netloc.lower())
        if not request_host or parsed.netloc.lower() != request_host.lower():
            raise ValueError("Origin/host mismatch")
        project = self._entries.get(key)
        if project is None:
            raise ValueError("Origin not registered")
        return project
