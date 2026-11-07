import ast
import base64
import gzip
import importlib.util
import json
import unittest
from pathlib import Path

SOURCE=Path(__file__).resolve().parents[1]/"scripts/stage_ionos_native_box.py"
spec=importlib.util.spec_from_file_location("native_stage",SOURCE)
stage=importlib.util.module_from_spec(spec);spec.loader.exec_module(stage)

class StageTests(unittest.TestCase):
    def entry(self,**changes):
        data=dict(pm_id=0,name="api",pid=3242908,
                  pm2_env=dict(status="online",pm_cwd="/var/www/bidblitz/backend"))
        data.update(changes);return data
    def select(self,items,pid="3242908",cwd="/var/www/bidblitz/backend"):
        return stage.pm2_target(items,pid,lambda _:cwd)
    def test_current_pm2_identity_matches_only_api_zero(self):
        result=self.select([self.entry(),self.entry(pm_id=8,name="bidblitz-frontend")])
        self.assertEqual(result["id"],0);self.assertEqual(result["name"],"api")
        self.assertNotIn("pm2_env",result)
    def test_pid_and_working_directory_must_still_match(self):
        for pid,cwd in [("3242909","/var/www/bidblitz/backend"),("3242908","/tmp")]:
            with self.assertRaises(stage.StageBlocked):self.select([self.entry()],pid,cwd)
    def test_missing_duplicate_wrong_target_or_stopped_denied(self):
        cases=[[],[self.entry(),self.entry()],[self.entry(pm_id=7)],
               [self.entry(pm_id=False)],[self.entry(pid=True)],
               [self.entry(pm2_env=dict(status="stopped",pm_cwd="/var/www/bidblitz/backend"))],
               [self.entry(pm2_env=dict(status="online",pm_cwd=None))]]
        for items in cases:
            with self.assertRaises(stage.StageBlocked):self.select(items)
    def test_embedded_sources_are_exact_bounded_and_protocols_equal(self):
        data=stage.unpack_bundle(stage.BUNDLE)
        self.assertEqual(set(data),stage.EXPECTED_FILES)
        self.assertEqual(data["ionos/backend/core/box_admin_delegation.py"],
                         data["box/backend/box_admin_delegation.py"])
        self.assertIn("require_owner",data["ionos/backend/routes/admin_box_native.py"])
    def test_bundle_path_injection_refused(self):
        data=stage.unpack_bundle(stage.BUNDLE);data["../../outside"]="bad"
        encoded=base64.b64encode(gzip.compress(json.dumps(data).encode())).decode()
        with self.assertRaises(stage.StageBlocked):stage.unpack_bundle(encoded)
    def test_oversized_decompression_refused(self):
        encoded=base64.b64encode(gzip.compress(b"x"*300000)).decode()
        with self.assertRaises(stage.StageBlocked):stage.unpack_bundle(encoded)
    def test_invalid_encoding_refused(self):
        for encoded in ("no base64",base64.b64encode(b"not gzip").decode()):
            with self.assertRaises(stage.StageBlocked):stage.unpack_bundle(encoded)
    def test_operator_invokes_only_readonly_pm2_status(self):
        tree=ast.parse(SOURCE.read_text())
        calls=[node for node in ast.walk(tree) if isinstance(node,ast.Call)
               and isinstance(node.func,ast.Attribute) and isinstance(node.func.value,ast.Name)
               and node.func.value.id=="subprocess" and node.func.attr=="run"]
        self.assertEqual(len(calls),1)
        self.assertEqual(ast.literal_eval(calls[0].args[0].elts[1]),"jlist")
        self.assertNotIn("npm",SOURCE.read_text())

if __name__=="__main__":unittest.main()
