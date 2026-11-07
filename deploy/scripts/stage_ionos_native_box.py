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

BUNDLE = "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"
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
