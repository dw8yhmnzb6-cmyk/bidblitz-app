import pytest
from core.analytics_project_registry import AnalyticsProjectRegistry

REG = AnalyticsProjectRegistry({
    "https://trade.bidblitz.ae": "trade",
    "https://eyes.bidblitz.ae": "eyes",
})

def test_registered_origins():
    assert REG.resolve("https://trade.bidblitz.ae") == "trade"
    assert REG.resolve("https://eyes.bidblitz.ae") == "eyes"

@pytest.mark.parametrize("origin", [
    "https://unregistered.example",
    "https://trade.bidblitz.ae.attacker.invalid",
    "https://trade.bidblitz.ae/private",
    "https://trade.bidblitz.ae?secret=1",
    "https://trade.bidblitz.ae@unregistered.example",
    "null",
])
def test_untrusted_origin_rejected(origin):
    with pytest.raises(ValueError):
        REG.resolve(origin)

def test_bad_registry_rejected():
    with pytest.raises(ValueError):
        AnalyticsProjectRegistry({"https://domain.example/extra": "trade"})
