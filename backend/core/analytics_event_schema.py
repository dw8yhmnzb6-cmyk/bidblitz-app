"""Analytics v1 schema. No active HTTP endpoint is added here."""
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field

class AnalyticsEventV1(BaseModel):
    model_config = ConfigDict(extra="forbid")
    project: Literal["bidblitz_main", "trade", "eyes", "power", "verify", "iptv", "games", "fuel", "identity", "stack"]
    event: Literal["page_view", "cta_click", "signup_started", "signup_completed", "checkout_started", "checkout_completed", "flow_abandoned"]
    path: str = Field(min_length=1, max_length=160, pattern=r"^/[a-z0-9/_-]*$")
    label: str | None = Field(default=None, max_length=60, pattern=r"^[A-Za-z0-9_-]+$")
    timestamp: str
