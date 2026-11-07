"""Root operator: stage the native BOX release; never modifies a running service or website."""
import base64
import gzip
import hashlib
import json
import os
import shutil
import socket
import subprocess
import tempfile
from pathlib import Path

BUNDLE = "__BUNDLE__"
EXPECTED_FILES = {
    "ionos/backend/core/box_admin_delegation.py",
    "ionos/backend/routes/admin_box_native.py",
    "ionos/frontend/admin-box-native.js",
    "ionos/box_native_admin_plan.py",
    "box/backend/box_admin_delegation.py",
    "box/backend/box_native_admin_inbox.py",
    "box/backend/box_native_admin_runtime.py",
    "box/tools/run_box_login.py",
}
class StageBlocked(ValueError):
    pass

def pm2_target(items, pid_text, cwd_for_pid):
    if not isinstance(items, list):
        raise StageBlocked("PM2-Prozessliste ungültig.")
    found = [p for p in items if isinstance(p,dict) and type(p.get("pm_id")) is int and p.get("pm_id") == 0 and p.get("name") == "api"]
    if len(found) != 1:
        raise StageBlocked("PM2 api/0 nicht eindeutig.")
    entry = found[0]
    pid = entry.get("pid")
    env = entry.get("pm2_env")
    if (type(pid) is not int or pid <= 1 or str(pid) != str(pid_text).strip()
            or not isinstance(env,dict) or env.get("status") != "online"
            or not isinstance(env.get("pm_cwd"),str)
            or env["pm_cwd"].rstrip("/") != "/var/www/bidblitz/backend"
            or cwd_for_pid(pid) != "/var/www/bidblitz/backend"):
        raise StageBlocked("PM2-Zuordnung hat sich geändert; kein Eingriff.")
    return {"id":0,"name":"api","pid":pid,"status":"online",
            "cwd":"/var/www/bidblitz/backend"}

def unpack_bundle(encoded):
    try:
        packed = base64.b64decode(encoded, validate=True)
        if len(packed) > 131072:
            raise StageBlocked("Paket zu groß.")
        # Bound decompression even though this embedded release is reviewed.
        import io
        with gzip.GzipFile(fileobj=io.BytesIO(packed)) as stream:
            raw = stream.read(262145)
        if len(raw) > 262144:
            raise StageBlocked("Paket zu groß.")
        data = json.loads(raw)
        if not isinstance(data,dict) or set(data) != EXPECTED_FILES:
            raise StageBlocked("Unerwartete Paketdateien.")
        if not all(isinstance(v,str) for v in data.values()):
            raise StageBlocked("Unerwarteter Dateiinhalt.")
        for name,content in data.items():
            if name.endswith(".py"):
                compile(content,name,"exec")
        if data["ionos/backend/core/box_admin_delegation.py"] != data["box/backend/box_admin_delegation.py"]:
            raise StageBlocked("Protokollversionen stimmen nicht überein.")
        return data
    except (ValueError,OSError,EOFError,SyntaxError) as error:
        if isinstance(error,StageBlocked):
            raise
        raise StageBlocked("Paketprüfung fehlgeschlagen.") from None

def main():
    if os.geteuid() != 0 or socket.gethostname().split(".")[0] != "ubuntu":
        raise StageBlocked("Im LINUX-Terminal auf IONOS als root ausführen.")
    root=Path("/var/www/bidblitz")
    registry=root/"backend/core/router_registry.py"
    index=root/"frontend/build/index.html"
    pid_file=Path("/root/.pm2/pids/api-0.pid")
    for p in (registry,index,pid_file):
        if not p.is_file() or p.is_symlink():
            raise StageBlocked("Erwartete reguläre Datei fehlt.")
    pm2=shutil.which("pm2")
    if not pm2:
        raise StageBlocked("PM2 nicht im Terminalpfad gefunden.")
    result=subprocess.run([pm2,"jlist"],capture_output=True,text=True,timeout=15)
    if result.returncode or len(result.stdout)>8388608:
        raise StageBlocked("PM2-Status konnte nicht gelesen werden.")
    try:items=json.loads(result.stdout)
    except ValueError:raise StageBlocked("PM2-Status konnte nicht gelesen werden.") from None
    target=pm2_target(items,pid_file.read_text(),
                      lambda pid:str((Path("/proc")/str(pid)/"cwd").resolve(strict=True)))
    files=unpack_bundle(BUNDLE)
    plan={}
    exec(compile(files["ionos/box_native_admin_plan.py"],"box_native_admin_plan.py","exec"),plan)
    before_index=index.read_bytes()
    before_registry=registry.read_bytes()
    asset_name,candidate_index=plan["plan_html"](before_index,files["ionos/frontend/admin-box-native.js"].encode())
    candidate_registry=plan["plan_registry"](before_registry.decode()).encode()
    folder=Path(tempfile.mkdtemp(prefix="bidblitz-native-box-stage-",dir="/root"))
    def save(relative,content):
        p=folder/relative
        p.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
        fd=os.open(p,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600)
        with os.fdopen(fd,"wb") as stream:stream.write(content)
    for name,content in files.items():save("source/"+name,content.encode())
    save("before/index.html",before_index)
    save("before/router_registry.py",before_registry)
    save("candidate/index.html",candidate_index)
    save("candidate/router_registry.py",candidate_registry)
    save("candidate/"+asset_name,files["ionos/frontend/admin-box-native.js"].encode())
    report={"stage_only":True,"pm2":target,"asset":asset_name,
            "before_index_sha256":hashlib.sha256(before_index).hexdigest(),
            "before_registry_sha256":hashlib.sha256(before_registry).hexdigest(),
            "candidate_index_sha256":hashlib.sha256(candidate_index).hexdigest(),
            "configuration_paired":False,"account_mapping_verified":False,
            "services_restarted":False,"website_modified":False}
    save("manifest.json",json.dumps(report,indent=2).encode())
    if index.read_bytes()!=before_index or registry.read_bytes()!=before_registry:
        raise StageBlocked("Webseite wurde parallel geändert. Kandidat nicht freigeben.")
    print("PAKET VORBEREITET; NOCH NICHT AKTIVIERT.")
    print("PM2-Ziel geprüft: api, ID 0.")
    print("Sicherung und Kandidat:",folder)
    print("Keine Dienste neu gestartet. Keine Webseite verändert.")
    print("Offen: private Serverkopplung und vorhandene BOX-Adminzuordnung.")

if __name__=="__main__":
    try:main()
    except (StageBlocked,OSError,subprocess.SubprocessError):
        raise SystemExit("VORBEREITUNG GESTOPPT. Kein Dienst oder Webseiteninhalt verändert.")
