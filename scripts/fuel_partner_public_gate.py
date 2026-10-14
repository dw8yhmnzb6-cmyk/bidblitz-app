"""Read-only post-release health gate for the existing BidBlitz Fuel partner page.

Never deploys or modifies a server. Fails if private admin or Fuel API routes
are publicly reachable from the Fuel marketing hostname.
"""
from __future__ import annotations

import argparse
import pathlib
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

REQUIRED_MARKERS = (
    '<html lang="de">',
    'Partnerprogramm',
    'Pilotphase in Vorbereitung',
    'Echte Zahlungen sind derzeit nicht aktiviert',
    'tel:+4920243047726',
    'Keine Live-Tankzahlung',
)
DENIED_PATHS = ('/api/fuel/status', '/admin/fuel', '/.env', '/.git/config')
DENIED_STATUS = {401, 403, 404, 410, 405}


def fetch(url: str) -> tuple[int, str, str, bytes]:
    """Return HTTP status, final URL, content type and body; verify TLS by default."""
    req = Request(url, headers={'Accept-Encoding': 'identity', 'User-Agent': 'BidBlitzFuelPublicGate/1.0'})
    try:
        with urlopen(req, timeout=8) as resp:
            return resp.status, resp.url, resp.headers.get('Content-Type', ''), resp.read(400_000)
    except HTTPError as error:
        return error.code, error.url, error.headers.get('Content-Type', ''), error.read(1000)


def verify_markup(content: bytes) -> list[str]:
    html = content.decode('utf-8', errors='replace')
    missing = [x for x in REQUIRED_MARKERS if x not in html]
    if '<form' in html.lower():
        missing.append('Unexpected public form')
    if '<script' in html.lower():
        missing.append('Unexpected public script')
    return missing


def verify_site(base: str, expected_html: bytes, getter=fetch) -> list[str]:
    url = base.rstrip('/')
    parsed = urlparse(url)
    if parsed.scheme != 'https' or not parsed.hostname or parsed.path or parsed.query or parsed.fragment:
        return ['Only a HTTPS host origin without a path is accepted']
    findings: list[str] = []
    for resource in ('/', '/fuel-partner.html'):
        target = url + resource
        try:
            status, final_url, content_type, body = getter(target)
        except (OSError, URLError, ValueError) as exc:
            findings.append(f'{resource}: cannot connect ({type(exc).__name__})')
            continue
        if urlparse(final_url).hostname != parsed.hostname or urlparse(final_url).scheme != 'https':
            findings.append(f'{resource}: redirected outside secure partner host')
        if status != 200 or 'text/html' not in content_type.lower():
            findings.append(f'{resource}: expected HTTP 200 HTML, got {status} ({content_type})')
            continue
        findings.extend(f'{resource}: {problem}' for problem in verify_markup(body))
        if resource == '/fuel-partner.html' and body != expected_html:
            findings.append('/fuel-partner.html: deployed HTML differs from the expected release file')
    for resource in DENIED_PATHS:
        try:
            status, final_url, _, _ = getter(url + resource)
        except (OSError, URLError, ValueError) as exc:
            findings.append(f'{resource}: cannot verify isolation ({type(exc).__name__})')
            continue
        if urlparse(final_url).hostname != parsed.hostname or status not in DENIED_STATUS:
            findings.append(f'{resource}: insecure exposure or unexpected redirect (HTTP {status})')
    return findings


def main() -> int:
    parser = argparse.ArgumentParser(description='Read-only BidBlitz Fuel public deployment verifier')
    parser.add_argument('--origin', default='https://fuel.bidblitz.ae')
    parser.add_argument(
        '--html', type=pathlib.Path,
        default=pathlib.Path(__file__).resolve().parents[1] / 'frontend/public/fuel-partner.html',
    )
    args = parser.parse_args()
    try:
        expected = args.html.read_bytes()
    except OSError as exc:
        print(f'FAIL: cannot read expected HTML: {exc}', file=sys.stderr)
        return 2
    failures = verify_site(args.origin, expected)
    for finding in failures:
        print('FAIL:', finding)
    if failures:
        print(f'NOT READY: {len(failures)} failed public-release checks')
        return 1
    print('READY: static partner page published; no private Fuel routes exposed by checks')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
