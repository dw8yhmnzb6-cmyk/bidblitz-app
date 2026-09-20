"""Static guards for the mobile BidBlitz Charge product scanner."""
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SCANNER = ROOT / "frontend" / "src" / "components" / "charge" / "ChargeProductScanner.jsx"
PAGE = ROOT / "frontend" / "src" / "pages" / "ChargeAppPage.jsx"
PACKAGE = ROOT / "frontend" / "package.json"


def _text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_existing_html5_qrcode_dependency_is_used():
    package = _text(PACKAGE)
    scanner = _text(SCANNER)
    assert '"html5-qrcode"' in package
    assert 'from "html5-qrcode"' in scanner
    assert "Html5QrcodeSupportedFormats.QR_CODE" in scanner
    assert "Html5QrcodeSupportedFormats.EAN_13" in scanner
    assert "Html5QrcodeSupportedFormats.CODE_128" in scanner


def test_camera_scanner_prefers_rear_camera_and_cleans_up():
    scanner = _text(SCANNER)
    assert "/back|rear|environment|rück/i" in scanner
    assert "if (active.isScanning) await active.stop()" in scanner
    assert "await active.clear()" in scanner
    assert "handledRef.current" in scanner


def test_scan_result_uses_same_canonical_backend_lookup_as_manual_input():
    page = _text(PAGE)
    assert "handleScannedProductCode" in page
    assert "lookupActivationProduct(code)" in page
    assert "api.lookupChargeProduct(code)" in page
    assert "charge-app-warranty-scan-button" in page
    assert "ChargeProductScanner" in page


def test_manual_code_entry_remains_available_as_fallback():
    page = _text(PAGE)
    scanner = _text(SCANNER)
    assert "charge-app-warranty-activation-code" in page
    assert "charge-app-warranty-activation-submit" in page
    assert "Du kannst den Code weiterhin manuell eingeben" in scanner
