"""Offline tests: public site health gate must fail closed."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'scripts'))
from fuel_partner_public_gate import verify_markup, verify_site, DENIED_PATHS

HTML = b'<html lang="de">Partnerprogramm Pilotphase in Vorbereitung Echte Zahlungen sind derzeit nicht aktiviert tel:+4920243047726 Keine Live-Tankzahlung</html>'
ORIGIN = 'https://fuel.bidblitz.ae'


def good_get(url):
    if url.endswith('/fuel-partner.html') or url == ORIGIN + '/':
        return 200, url, 'text/html; charset=utf-8', HTML
    return 404, url, 'text/plain', b''


class ReleaseGateTests(unittest.TestCase):
    def test_good_marketing_only_site(self):
        self.assertEqual(verify_site(ORIGIN, HTML, good_get), [])

    def test_api_exposure_is_blocker(self):
        def leak(url):
            if url.endswith(DENIED_PATHS[0]):
                return 200, url, 'application/json', b'{}'
            return good_get(url)
        self.assertTrue(any('api/fuel/status' in x for x in verify_site(ORIGIN, HTML, leak)))

    def test_unexpected_page_is_blocker(self):
        def stale(url):
            response = good_get(url)
            if url.endswith('fuel-partner.html'):
                return response[:3] + (HTML + b' stale',)
            return response
        self.assertTrue(any('differs' in x for x in verify_site(ORIGIN, HTML, stale)))

    def test_no_http_or_other_hostname(self):
        self.assertTrue(verify_site('http://fuel.bidblitz.ae', HTML, good_get))
        def redirect(url):
            if url.endswith('fuel-partner.html'):
                return 200, 'https://external.example/fuel-partner.html', 'text/html', HTML
            return good_get(url)
        self.assertTrue(any('redirected outside' in x for x in verify_site(ORIGIN, HTML, redirect)))

    def test_no_public_form_or_script(self):
        self.assertTrue(verify_markup(HTML + b'<script>alert(1)</script>'))
        self.assertTrue(verify_markup(HTML + b'<form></form>'))

    def test_unreachable_is_not_success(self):
        def down(url):
            raise OSError('No route')
        self.assertTrue(verify_site(ORIGIN, HTML, down))


if __name__ == '__main__':
    unittest.main()
