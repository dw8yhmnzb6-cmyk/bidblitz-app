"""Isolated native proxy tests; never imports or connects the production database."""
import importlib.util
import json
import os
import sys
import types
import unittest
import tempfile
import sqlite3
import uuid
from pathlib import Path
from unittest.mock import AsyncMock, patch
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
owner = AsyncMock(return_value={"id":"central-owner","email":"owner@example.invalid"})
stub = types.ModuleType("routes.admin_projects")
stub.require_owner = owner
with patch.dict(sys.modules, {"routes.admin_projects":stub}):
    spec=importlib.util.spec_from_file_location("isolated_box_native_route", ROOT/"routes/admin_box_native.py")
    module=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

class Stream:
    def __init__(self,status,body):
        self.status_code=status
        self.body=json.dumps(body).encode()
    async def __aenter__(self):return self
    async def __aexit__(self,*args):pass
    async def aiter_bytes(self):
        yield self.body

class Client:
    status=200
    body={"applications":[],"has_more":False,"next_cursor":None}
    calls=[]
    def __init__(self,**options):self.options=options
    async def __aenter__(self):return self
    async def __aexit__(self,*args):pass
    def stream(self,method,url,**kwargs):
        self.calls.append((self.options,method,url,kwargs))
        return Stream(self.status,self.body)

class ProxyTests(unittest.TestCase):
    def setUp(self):
        owner.reset_mock()
        owner.side_effect=None
        owner.return_value={"id":"central-owner"}
        self.env=patch.dict(os.environ,{
            "BIDBLITZ_NATIVE_BOX_INBOX_ENABLED":"true",
            "BIDBLITZ_NATIVE_BOX_INBOX_SECRET":"test-only-"+"x"*40})
        self.env.start()
        self.transport=patch.object(module.httpx,"AsyncClient",Client)
        self.transport.start()
        Client.calls=[];Client.status=200
        Client.body={"applications":[],"has_more":False,"next_cursor":None}
        app=FastAPI();app.include_router(module.router)
        self.client=TestClient(app)
    def tearDown(self):
        self.client.close();self.transport.stop();self.env.stop()
    def test_current_owner_authentication_required_first(self):
        owner.side_effect=HTTPException(401,"Session revoked")
        self.assertEqual(self.client.get("/api/admin/box/partner-applications").status_code,401)
        self.assertEqual(Client.calls,[])
    def test_non_owner_cannot_proxy(self):
        owner.side_effect=HTTPException(403,"Owner required")
        self.assertEqual(self.client.get("/api/admin/box/partner-applications").status_code,403)
        self.assertEqual(Client.calls,[])
    def test_explicit_activation_required(self):
        os.environ["BIDBLITZ_NATIVE_BOX_INBOX_ENABLED"]="false"
        self.assertEqual(self.client.get("/api/admin/box/partner-applications").status_code,503)
        self.assertEqual(Client.calls,[])
    def test_native_proxy_has_fixed_destination_and_no_browser_credential_forwarding(self):
        self.client.cookies.set("access_token","browser-cookie")
        r=self.client.get("/api/admin/box/partner-applications?after=7",
                          headers={"authorization":"Bearer browser-secret"})
        self.assertEqual(r.status_code,200)
        self.assertEqual(r.json(),Client.body)
        self.assertIn("no-store",r.headers["cache-control"])
        options,method,url,kwargs=Client.calls[0]
        self.assertFalse(options["follow_redirects"])
        self.assertFalse(options["trust_env"])
        self.assertEqual(url,module.TARGET)
        self.assertEqual(set(kwargs["headers"]),{"X-BidBlitz-Box-Delegation","Accept"})
        from core.box_admin_delegation import verify
        claims=verify(os.environ["BIDBLITZ_NATIVE_BOX_INBOX_SECRET"],
                      kwargs["headers"]["X-BidBlitz-Box-Delegation"],"7")
        self.assertEqual(claims["sub"],"central-owner")
    def test_invalid_and_duplicate_cursors_rejected(self):
        for query in ("after=-1","after=0&after=1","url=https://example.invalid","after=1.5"):
            self.assertEqual(self.client.get("/api/admin/box/partner-applications?"+query).status_code,400)
        self.assertEqual(Client.calls,[])
    def test_box_permission_denial_preserved(self):
        Client.status=403
        self.assertEqual(self.client.get("/api/admin/box/partner-applications").status_code,403)
    def test_redirect_not_treated_as_data(self):
        Client.status=302
        self.assertEqual(self.client.get("/api/admin/box/partner-applications").status_code,502)
    def test_malformed_payload_not_displayed_as_empty(self):
        for body in ({"error":"bad"},{"applications":[],"has_more":"false","next_cursor":None},
                     {"applications":[None],"has_more":False,"next_cursor":None}):
            Client.body=body
            self.assertEqual(self.client.get("/api/admin/box/partner-applications").status_code,502)
    def test_oversized_response_rejected(self):
        Client.body={"applications":["x"*140000],"has_more":False,"next_cursor":None}
        self.assertEqual(self.client.get("/api/admin/box/partner-applications").status_code,502)
    def test_sender_receiver_integration_reads_fixture_inside_same_origin_api(self):
        box_root=ROOT.parents[1]/"box-courier-scan-reset-20261105"/"backend"
        if not box_root.is_dir():
            self.skipTest("Companion BOX checkout required for integration test")
        sys.path.insert(0,str(box_root))
        from box_native_admin_inbox import NativeBoxInbox
        from box_admin_delegation import PATH,ReplayStore,initialize_replay_store
        from box_partner_applications import DDL,receive
        with tempfile.TemporaryDirectory() as directory:
            database=Path(directory)/"box.db"
            replay=Path(directory)/"replay.db"
            initialize_replay_store(replay)
            with sqlite3.connect(database) as db:
                db.execute("CREATE TABLE admin_accounts(id TEXT PRIMARY KEY,role TEXT,state TEXT)")
                db.execute("INSERT INTO admin_accounts VALUES ('local-admin','admin','ACTIVE')")
                db.execute(DDL)
            receive(database,dict(business="Testgeschäft",city="Prishtina",address="Teststraße 1",
                contact="Testkontakt",email="test@example.invalid",phone="",hours="09-18",space="",
                request_key=str(uuid.uuid4()),locale="de",consent=True))
            receiver=NativeBoxInbox(database,secret=os.environ["BIDBLITZ_NATIVE_BOX_INBOX_SECRET"],
                subjects={"central-owner":"local-admin"},replay=ReplayStore(replay),enabled=True)
            def forward(client,method,url,**kwargs):
                result={}
                def start(status,headers):result["status"]=int(status.split()[0])
                body=b"".join(receiver(dict(PATH_INFO=PATH,REQUEST_METHOD=method,
                    QUERY_STRING="after="+kwargs["params"]["after"],
                    **{"wsgi.url_scheme":"https",
                       "HTTP_X_BIDBLITZ_BOX_DELEGATION":kwargs["headers"]["X-BidBlitz-Box-Delegation"]}),start))
                return Stream(result["status"],json.loads(body))
            with patch.object(Client,"stream",forward):
                response=self.client.get("/api/admin/box/partner-applications")
            self.assertEqual(response.status_code,200)
            self.assertEqual(response.json()["applications"][0]["business"],"Testgeschäft")
            self.assertEqual(response.headers["cache-control"],"no-store, private")

    def test_missing_server_secret_fails_closed(self):
        os.environ["BIDBLITZ_NATIVE_BOX_INBOX_SECRET"]=""
        self.assertEqual(self.client.get("/api/admin/box/partner-applications").status_code,503)
        self.assertEqual(Client.calls,[])

if __name__=="__main__":unittest.main()
