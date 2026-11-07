import ast
import hashlib
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
import box_native_admin_plan as plan

class PublicationPlanTests(unittest.TestCase):
    def html(self):
        base=b"<!doctype html><html><body><div id='root'></div><script src='/static/js/current.js'></script></body></html>"
        old=b'\n<!-- BIDBLITZ_ADMIN_BOX_LINK_V3 -->\n<script>old_external_link()</script>\n'
        return base,base.replace(b"</body>",old+b"</body>")
    def test_html_keeps_existing_site_byte_for_byte(self):
        base,source=self.html()
        with patch.object(plan,"BASELINE_INDEX_SHA256",hashlib.sha256(base).hexdigest()):
            name,result=plan.plan_html(source,b"reviewed-ui")
        self.assertEqual(name,"admin-box-native."+hashlib.sha256(b"reviewed-ui").hexdigest()[:16]+".js")
        self.assertIn(b"/static/js/current.js",result)
        self.assertNotIn(b"old_external_link",result)
        self.assertIn(b"window.BidBlitzBoxInbox.mount(card)",result)
        self.assertNotIn(b"box.bidblitz.ae",result)
        marker=result.index(b"\n<!-- "+plan.HTML_MARKER.encode())
        end=result.index(b"</body>",marker)
        self.assertEqual(result[:marker]+result[end:],base)
    def test_changed_site_or_unknown_link_never_overwritten(self):
        base,source=self.html()
        for value in (source,base,source+source):
            with self.assertRaises(ValueError):plan.plan_html(value,b"ui")
    def test_already_native_html_requires_review(self):
        with self.assertRaises(ValueError):
            plan.plan_html(plan.HTML_MARKER.encode(),b"ui")
    def test_registry_adds_only_one_router_and_is_idempotent(self):
        source='def register_all_routers(app):\n    routers = [\n        ("routes.admin_projects", "router"),\n    ]\n    return routers\n'
        result=plan.plan_registry(source)
        ast.parse(result)
        self.assertEqual(result.count('("routes.admin_box_native", "router")'),1)
        self.assertEqual(plan.plan_registry(result),result)
        self.assertEqual(result.replace('\n        ("routes.admin_box_native", "router"),',""),source)
    def test_unknown_registry_refused(self):
        for source in ("invalid python = ?",'def register_all_routers(app):\n    pass\n'):
            with self.assertRaises((ValueError,SyntaxError)):plan.plan_registry(source)
    def test_proxy_exact_path_get_only_and_no_browser_credential_forwarding(self):
        source="server {\n    # BOX_PARTNER_APPLICATIONS_V1_END\n}\n"
        result=plan.plan_box_proxy(source)
        self.assertEqual(result.count(plan.NATIVE_PATH),1)
        for value in ('if ($request_method != GET)', 'proxy_set_header Cookie "";',
                      'proxy_set_header Authorization "";','proxy_set_header Origin "";',
                      'proxy_set_header X-BidBlitz-Box-Delegation', 'access_log off;'):
            self.assertIn(value,result)
        self.assertEqual(plan.plan_box_proxy(result),result)
    def test_unknown_proxy_refused(self):
        for source in ("server {}",plan.NATIVE_PATH,"# BOX_PARTNER_APPLICATIONS_V1_END\n"*2):
            with self.assertRaises(ValueError):plan.plan_box_proxy(source)

if __name__=="__main__":unittest.main()
