"""Strict event contract for future first-party BidBlitz analytics collection.

This module is validation only. A collector must separately enforce server-side
project identity, rate limits, consent policy and retention before activation.
"""
from datetime import datetime, timezone, timedelta
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

ProjectName = Literal["bidblitz_main", "trade", "eyes", "power", "verify", "iptv", "games", "fuel", "identity", "stack"]
EventName = Literal["page_view", "cta_click", "signup_started", "signup_completed", "checkout_started", "checkout_completed", "flow_abandoned"]

class AnalyticsEventV1(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    project: ProjectName
    event: EventName
    # Template paths only: no IDs, query parameters or free-form user input.
    path: str = Field(min_length=1, max_length=160, pattern=r"^/(?:[a-z][a-z0-9_-]*/?)*$")
    label: str | None = Field(default=None, max_length=60, pattern=r"^[a-z][a-z0-9_-]*$")
    timestamp: datetime

    @field_validator("timestamp")
    @classmethod
    def timezone_required(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("Timestamp must include timezone")
        return value.astimezone(timezone.utc)

    @model_validator(mode="after")
    def forbid_untrusted_payment_confirmation(self):
        # A browser cannot assert financial success; backend payment ledger owns it.
        if self.event == "checkout_completed":
            raise ValueError("checkout_completed requires verified server-side event")
        return self

def validated_project(event: AnalyticsEventV1, trusted_project: str) -> str:
    """Project identity must be independently resolved by server configuration."""
    if trusted_project != event.project:
        raise ValueError("Project mismatch")
    return trusted_project
