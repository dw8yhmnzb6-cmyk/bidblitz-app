"""Trade BidBlitz trading core.

This package is intentionally isolated from the existing MongoDB application.
Nothing in here is imported by the production server until a trade-core feature
is explicitly wired in.
"""

__all__ = ["db"]
