#!/usr/bin/env python3
"""User-operated IONOS BOX Admin entry release; no service or database changes."""
from pathlib import Path
import fcntl, hashlib, os, shutil, subprocess, tempfile, time, urllib.request

FRONT = Path("/var/www/bidblitz/frontend")
REL = "src/components/admin/AdminPartnerApplications.js"
EXPECTED = "ce9b2f24e34070c0288e1547f6cb3dc9de9243594d4438310577ebc830468c73"
MARKER = "BOX_PARTNER_INBOX_V1"
ANCHOR = '    <div className="space-y-4 sm:space-y-6">\n'
CARD = "      {/* BOX_PARTNER_INBOX_V1 */}\n      <section className=\"rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-3\" aria-label=\"BOX-Standortbewerbungen\" data-testid=\"admin-box-partner-entry\">\n        <h3 className=\"text-base font-bold text-emerald-900\">BOX-Standortbewerbungen</h3>\n        <p className=\"text-sm text-gray-700\">Bewerbungen von Geschäften für einen BOX-Standort findest du im geschützten BOX-Posteingang.</p>\n        <a href=\"https://box.bidblitz.ae/admin/partner-applications\" target=\"_blank\" rel=\"noopener noreferrer\" className=\"inline-flex min-h-[44px] items-center justify-center rounded-lg bg-emerald-800 px-4 py-3 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800\">BOX-Posteingang öffnen ↗</a>\n        <p className=\"text-sm text-gray-700\">Öffnet in einem neuen Tab. Du brauchst eine aktive BOX-Anmeldung und eine Adminberechtigung für BOX.</p>\n        <a href=\"https://box.bidblitz.ae/auth/login\" target=\"_blank\" rel=\"noopener noreferrer\" className=\"inline-flex min-h-[44px] items-center text-sm font-semibold text-emerald-900 underline\">Bei BOX anmelden ↗</a>\n      </section>\n"
def digest(data):
    return hashlib.sha256(data).hexdigest()

def patch(data):
    if digest(data) != EXPECTED:
        raise RuntimeError("Admin-Datei hat sich geändert; nichts veröffentlicht.")
    text = data.decode("utf-8")
    if text.count(ANCHOR) != 1:
        raise RuntimeError("Seitenaufbau unerwartet; nichts veröffentlicht.")
    return text.replace(ANCHOR, ANCHOR + CARD, 1).encode("utf-8")

def public_index():
    request = urllib.request.Request(
        "https://bidblitz.ae/admin?box_check=" + str(time.time_ns()),
        headers={"Cache-Control": "no-cache", "Accept-Encoding": "identity"})
    with urllib.request.urlopen(request, timeout=20) as response:
        if response.status != 200:
            raise RuntimeError("Öffentliche Admin-Seite antwortet nicht mit 200.")
        return response.read()

def main(state_root=Path("/root")):
    if os.geteuid() != 0:
        raise RuntimeError("Im IONOS-Terminal als root ausführen.")
    with open(state_root / "box-admin-entry-release.lock", "a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        return release(state_root)

def release(state_root):
    source, live = FRONT / REL, FRONT / "build"
    before = source.read_bytes()
    candidate = patch(before)
    if not (live / "index.html").is_file() or live.is_symlink():
        raise RuntimeError("Unerwarteter Build-Pfad; nichts geändert.")
    if public_index() != (live / "index.html").read_bytes():
        raise RuntimeError("Öffentliche Seite passt nicht zum Build; nichts geändert.")
    if shutil.disk_usage(FRONT).free < 2 * 1024**3:
        raise RuntimeError("Weniger als 2 GB frei; nichts geändert.")
    backup = Path(tempfile.mkdtemp(prefix="box-admin-entry-", dir=state_root))
    (backup / "AdminPartnerApplications.before.js").write_bytes(before)
    built, old = backup / "new-build", backup / "old-build"
    if backup.stat().st_dev != FRONT.stat().st_dev:
        raise RuntimeError("Build und Sicherung liegen auf verschiedenen Laufwerken.")
    changed = False
    try:
        if source.read_bytes() != before:
            raise RuntimeError("Quelldatei wurde parallel verändert.")
        source.write_bytes(candidate)
        changed = True
        env = dict(os.environ, BUILD_PATH=str(built))
        print("Build läuft. Protokoll:", backup / "build.log", flush=True)
        with (backup / "build.log").open("w") as log:
            subprocess.run(["npm", "run", "build"], cwd=FRONT, env=env,
                           stdout=log, stderr=subprocess.STDOUT, check=True, timeout=1200)
        bundles = list((built / "static/js").glob("*.js"))
        if not (built / "index.html").is_file() or not any(
                b"BOX-Standortbewerbungen" in p.read_bytes() for p in bundles):
            raise RuntimeError("BOX-Zugang fehlt im neuen Build.")
        if source.read_bytes() != candidate:
            raise RuntimeError("Quelldatei wurde während des Builds verändert.")
        # Keep hashed assets requested by already open browser sessions.
        for p in (live / "static").rglob("*"):
            dest = built / "static" / p.relative_to(live / "static")
            if p.is_file() and not dest.exists():
                dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(p, dest)
        live.rename(old)
        built.rename(live)
        if public_index() != (live / "index.html").read_bytes():
            raise RuntimeError("Öffentliche Abschlussprüfung fehlgeschlagen.")
    except BaseException:
        if old.exists():
            if live.exists():
                live.rename(backup / "failed-build")
            old.rename(live)
        if changed and source.read_bytes() == candidate:
            source.write_bytes(before)
        print("ABGEBROCHEN. Sicherung und Build-Protokoll:", backup)
        raise
    print("BOX-EINSTIEG VERÖFFENTLICHT; öffentlicher Build geprüft.")
    print("Admin → Partner Portal → BOX-Standortbewerbungen")
    print("Sicherung:", backup)

if __name__ == "__main__":
    main()
