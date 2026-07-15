"""
Diagnostic endpoints — Router registration state + live route inventory + deep health check.

/api/diag/routes
  Admin-only. Liefert komplette Router-Registry-Übersicht.

/api/diag/health-deep
  Admin-only. Ein-Request-Übersicht aller Systemkomponenten (DB, 3rd-party keys,
  externe Services, Bot-Loop-Iterationen). Ideal als Pre-Deploy-Smoke und Live-Health-Monitor.

Verhindert dass ein Syntax-Error in einem Route-Modul stillschweigend einen ganzen
Endpoint-Bereich aussetzt (siehe iter98 Bug: express_checkout_stripe.py).
"""
import os
import time
import asyncio
import json
import shutil
import subprocess
import tomllib
from datetime import datetime, timezone, timedelta
from pathlib import Path
from fastapi import APIRouter, HTTPException, Request
from core.security import get_current_user
from core.database import db
from core.router_registry import get_registration_state

router = APIRouter(prefix="/api/diag", tags=["diagnostics"])

RTK_BINARY_CANDIDATES = [
    Path("/root/.cargo/bin/rtk"),
    Path("/usr/local/bin/rtk"),
    Path.home() / ".local" / "bin" / "rtk",
]
RTK_CONFIG_PATH = Path.home() / ".config" / "rtk" / "config.toml"
RTK_FILTERS_PATH = Path.home() / ".config" / "rtk" / "filters.toml"
RTK_PROJECT_FILTERS_PATH = Path("/app/.rtk/filters.toml")
RTK_TRUST_STORE_PATH = Path.home() / ".local" / "share" / "rtk" / "trusted_filters.json"
RTK_PROJECT_ROOT = Path("/app")
RTK_ACTION_LOG_PATH = Path.home() / ".local" / "share" / "rtk" / "admin_actions.jsonl"


async def _require_admin(request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin access required")
    return user


def _find_rtk_binary() -> str | None:
    for candidate in RTK_BINARY_CANDIDATES:
        if candidate.exists() and os.access(candidate, os.X_OK):
            return str(candidate)
    return shutil.which("rtk")


def _run_rtk_command(args: list[str], timeout: int = 10, cwd: str | None = None) -> dict:
    binary = _find_rtk_binary()
    if not binary:
        return {
            "available": False,
            "exit_code": None,
            "stdout": "",
            "stderr": "RTK binary not found",
            "command": args,
        }

    try:
        proc = subprocess.run(
            [binary, *args],
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
            cwd=cwd,
        )
        return {
            "available": True,
            "exit_code": proc.returncode,
            "stdout": proc.stdout or "",
            "stderr": proc.stderr or "",
            "command": args,
            "cwd": cwd,
        }
    except subprocess.TimeoutExpired:
        return {
            "available": True,
            "exit_code": None,
            "stdout": "",
            "stderr": f"Timeout after {timeout}s",
            "command": args,
            "cwd": cwd,
        }
    except Exception as exc:
        return {
            "available": True,
            "exit_code": None,
            "stdout": "",
            "stderr": str(exc),
            "command": args,
            "cwd": cwd,
        }


def _read_text(path: Path) -> str:
    try:
        return path.read_text()
    except Exception:
        return ""


def _read_json(path: Path):
    try:
        if not path.exists():
            return None
        return json.loads(path.read_text())
    except Exception:
        return None


def _append_rtk_action_event(action: str, ok: bool, message: str, result: dict | None = None):
    try:
        RTK_ACTION_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
        entry = {
            "action": action,
            "ok": ok,
            "message": message,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "summary": {
                "exit_code": (result or {}).get("exit_code"),
                "stdout": ((result or {}).get("stdout") or "")[:400],
                "stderr": ((result or {}).get("stderr") or "")[:400],
            },
        }
        with RTK_ACTION_LOG_PATH.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(entry, ensure_ascii=False) + "\n")
    except Exception:
        return


def _read_rtk_action_history(limit: int = 12) -> list[dict]:
    if not RTK_ACTION_LOG_PATH.exists():
        return []
    try:
        lines = RTK_ACTION_LOG_PATH.read_text(encoding="utf-8").splitlines()
        items = []
        for raw in reversed(lines[-limit:]):
            try:
                items.append(json.loads(raw))
            except Exception:
                continue
        return items
    except Exception:
        return []


def _load_rtk_config_state() -> dict:
    raw = _read_text(RTK_CONFIG_PATH)
    parsed = {}
    if raw:
        try:
            parsed = tomllib.loads(raw)
        except Exception:
            parsed = {}

    hooks = parsed.get("hooks", {}) if isinstance(parsed, dict) else {}
    telemetry = parsed.get("telemetry", {}) if isinstance(parsed, dict) else {}

    return {
        "path": str(RTK_CONFIG_PATH),
        "exists": RTK_CONFIG_PATH.exists(),
        "filters_template_exists": RTK_FILTERS_PATH.exists(),
        "project_filters_exists": RTK_PROJECT_FILTERS_PATH.exists(),
        "include_commands": hooks.get("include_commands") or [],
        "exclude_commands": hooks.get("exclude_commands") or [],
        "transparent_prefixes": hooks.get("transparent_prefixes") or [],
        "telemetry_enabled": bool(telemetry.get("enabled", False)),
        "telemetry_consented": bool(telemetry.get("consent_given", False)),
    }


def _load_rtk_project_filters_state() -> dict:
    raw = _read_text(RTK_PROJECT_FILTERS_PATH)
    parsed = {}
    if raw:
        try:
            parsed = tomllib.loads(raw)
        except Exception:
            parsed = {}

    trust_store = _read_json(RTK_TRUST_STORE_PATH) or {}
    trusted = False
    trust_blob = json.dumps(trust_store) if isinstance(trust_store, dict) else ""
    if str(RTK_PROJECT_FILTERS_PATH) in trust_blob or '"/app"' in trust_blob:
        trusted = True

    filter_names = []
    filters_obj = parsed.get("filters") if isinstance(parsed, dict) else None
    if isinstance(filters_obj, dict):
        filter_names = sorted(filters_obj.keys())

    return {
        "path": str(RTK_PROJECT_FILTERS_PATH),
        "exists": RTK_PROJECT_FILTERS_PATH.exists(),
        "trusted": trusted,
        "trust_store_path": str(RTK_TRUST_STORE_PATH),
        "project_root": str(RTK_PROJECT_ROOT),
        "schema_version": parsed.get("schema_version") if isinstance(parsed, dict) else None,
        "filter_count": len(filter_names),
        "filter_names": filter_names,
    }


def _action_response(ok: bool, action: str, result: dict | None = None, message: str | None = None) -> dict:
    resolved_message = message or ("done" if ok else "failed")
    _append_rtk_action_event(action, ok, resolved_message, result=result)
    payload = {
        "ok": ok,
        "action": action,
        "message": resolved_message,
        "result": result or {},
    }
    payload["status"] = _build_rtk_status_payload()
    return payload


def _detect_rtk_hooks() -> dict:
    claude_settings = Path.home() / ".claude" / "settings.json"
    claude_rtk_md = Path.home() / ".claude" / "RTK.md"
    claude_claude_md = Path.home() / ".claude" / "CLAUDE.md"
    cursor_hooks = Path.home() / ".cursor" / "hooks.json"
    codex_agents = Path.home() / ".codex" / "AGENTS.md"
    codex_rtk = Path.home() / ".codex" / "RTK.md"
    gemini_settings = Path.home() / ".gemini" / "settings.json"
    gemini_hook = Path.home() / ".gemini" / "hooks" / "rtk-hook-gemini.sh"
    gemini_md = Path.home() / ".gemini" / "GEMINI.md"
    hermes_config = Path.home() / ".hermes" / "config.yaml"
    hermes_plugin = Path.home() / ".hermes" / "plugins" / "rtk-rewrite" / "plugin.yaml"

    claude_text = _read_text(claude_settings)
    cursor_text = _read_text(cursor_hooks)
    codex_text = _read_text(codex_agents)
    gemini_text = _read_text(gemini_settings)
    hermes_text = _read_text(hermes_config)

    agents = [
        {
            "id": "claude",
            "label": "Claude",
            "configured": "rtk hook claude" in claude_text,
            "details": "PreToolUse Hook",
            "path": str(claude_settings),
            "meta_files": [str(claude_rtk_md), str(claude_claude_md)],
            "meta_present": claude_rtk_md.exists() and claude_claude_md.exists(),
        },
        {
            "id": "cursor",
            "label": "Cursor",
            "configured": "rtk hook cursor" in cursor_text,
            "details": "hooks.json preToolUse",
            "path": str(cursor_hooks),
            "meta_files": [],
            "meta_present": cursor_hooks.exists(),
        },
        {
            "id": "codex",
            "label": "Codex",
            "configured": "RTK.md" in codex_text and codex_rtk.exists(),
            "details": "AGENTS.md + RTK.md",
            "path": str(codex_agents),
            "meta_files": [str(codex_rtk)],
            "meta_present": codex_rtk.exists(),
        },
        {
            "id": "gemini",
            "label": "Gemini",
            "configured": "rtk-hook-gemini.sh" in gemini_text and gemini_hook.exists(),
            "details": "BeforeTool Hook",
            "path": str(gemini_settings),
            "meta_files": [str(gemini_hook), str(gemini_md)],
            "meta_present": gemini_hook.exists() and gemini_md.exists(),
        },
        {
            "id": "hermes",
            "label": "Hermes",
            "configured": "rtk-rewrite" in hermes_text and hermes_plugin.exists(),
            "details": "Plugin Adapter",
            "path": str(hermes_config),
            "meta_files": [str(hermes_plugin)],
            "meta_present": hermes_plugin.exists(),
        },
    ]

    configured_count = sum(1 for agent in agents if agent["configured"])
    return {
        "configured_count": configured_count,
        "total_agents": len(agents),
        "agents": agents,
    }


def _build_rtk_status_payload() -> dict:
    binary_path = _find_rtk_binary()
    version_result = _run_rtk_command(["--version"])
    gain_result = _run_rtk_command(["gain", "--all", "--format", "json"], timeout=15)
    config_state = _load_rtk_config_state()
    project_filters_state = _load_rtk_project_filters_state()
    hooks_state = _detect_rtk_hooks()

    gain_json = {"summary": {"total_commands": 0, "total_saved": 0, "avg_savings_pct": 0.0}}
    if gain_result.get("stdout", "").strip():
        try:
            gain_json = json.loads(gain_result["stdout"])
        except Exception:
            gain_json = {
                "summary": {"total_commands": 0, "total_saved": 0, "avg_savings_pct": 0.0},
                "parse_error": gain_result["stdout"][:500],
            }

    rewrite_inputs = [
        ["git", "status"],
        ["pytest", "-q"],
        ["curl", "https://example.com"],
        ["docker", "run", "alpine", "echo", "hi"],
    ]
    rewrite_samples = []
    for sample in rewrite_inputs:
        result = _run_rtk_command(["rewrite", *sample])
        rewritten_output = (result.get("stdout") or "").strip() or None
        rewrite_samples.append(
            {
                "input": " ".join(sample),
                "rewritten_output": rewritten_output,
                "exit_code": result.get("exit_code"),
                "rewritten": bool(rewritten_output),
                "status": "rewritten" if rewritten_output else ("passthrough" if result.get("exit_code") == 1 else "unavailable"),
            }
        )

    binary_source = "missing"
    if binary_path:
        if binary_path.startswith("/root/.cargo/bin"):
            binary_source = "local_build"
        elif binary_path.startswith("/usr/local/bin"):
            binary_source = "system_install"
        else:
            binary_source = "path_install"

    notes = []
    if not binary_path:
        notes.append("RTK binary nicht gefunden")
    if config_state["telemetry_enabled"]:
        notes.append("Telemetry ist aktiv")
    if hooks_state["configured_count"] < hooks_state["total_agents"]:
        notes.append("Nicht alle unterstützten Agent-Setups sind aktiv")
    if not config_state["include_commands"]:
        notes.append("Keine include_commands gesetzt — RTK rewritet potenziell breiter")
    if project_filters_state["exists"] and not project_filters_state["trusted"]:
        notes.append("Projekt-Filter vorhanden, aber noch nicht per rtk trust freigegeben")

    return {
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "binary": {
            "available": bool(binary_path),
            "path": binary_path,
            "version": (version_result.get("stdout") or "").strip() or None,
            "install_source": binary_source,
            "error": (version_result.get("stderr") or "").strip() or None,
        },
        "config": config_state,
        "project_filters": project_filters_state,
        "hooks": hooks_state,
        "gain": gain_json,
        "rewrite_samples": rewrite_samples,
        "action_history": _read_rtk_action_history(),
        "notes": notes,
    }


@router.get("/routes")
async def diag_routes(request: Request, include_traceback: bool = False):
    """Liste aller registrierten + fehlgeschlagenen Route-Module + live API-Pfade."""
    await _require_admin(request)
    state = get_registration_state()

    # Live route inventory (alle /api Pfade die im laufenden App-Object hängen)
    paths = []
    for r in request.app.routes:
        try:
            path = getattr(r, "path", None)
            if not path or not path.startswith("/api"):
                continue
            methods_raw = getattr(r, "methods", None) or []
            methods = sorted([m for m in methods_raw if m not in ("HEAD", "OPTIONS")])
            paths.append({"path": path, "methods": methods})
        except Exception:
            continue

    failed_view = []
    for f in state.get("failed", []):
        entry = {
            "module": f["module"],
            "attr": f["attr"],
            "error_type": f["error_type"],
            "error": f["error"],
        }
        if include_traceback:
            entry["traceback"] = f.get("traceback", "")
        failed_view.append(entry)

    return {
        "total_registered": state.get("total_registered", 0),
        "total_failed": state.get("total_failed", 0),
        "registered": state.get("registered", []),
        "failed": failed_view,
        "live_paths_count": len(paths),
        "live_paths": sorted(paths, key=lambda x: x["path"]),
    }


@router.get("/routes/failed")
async def diag_failed_only(request: Request):
    """Kurzfassung: nur fehlgeschlagene Module — perfekt für Health-Checks/Alerting."""
    await _require_admin(request)
    state = get_registration_state()
    return {
        "total_failed": state.get("total_failed", 0),
        "failed": [
            {"module": f["module"], "error_type": f["error_type"], "error": f["error"]}
            for f in state.get("failed", [])
        ],
    }


@router.get("/rtk")
async def diag_rtk_status(request: Request):
    await _require_admin(request)
    return await asyncio.to_thread(_build_rtk_status_payload)


@router.post("/rtk/trust-project-filters")
async def diag_rtk_trust_project_filters(request: Request):
    await _require_admin(request)
    if not RTK_PROJECT_FILTERS_PATH.exists():
        raise HTTPException(404, "Projektfilter-Datei nicht gefunden")

    def _run():
        result = _run_rtk_command(["trust"], timeout=20, cwd=str(RTK_PROJECT_ROOT))
        ok = result.get("exit_code") == 0
        return _action_response(ok, "trust_project_filters", result=result, message="Projektfilter wurden vertraut" if ok else "Projektfilter konnten nicht vertraut werden")

    return await asyncio.to_thread(_run)


@router.post("/rtk/telemetry/forget")
async def diag_rtk_telemetry_forget(request: Request):
    await _require_admin(request)

    def _run():
        result = _run_rtk_command(["telemetry", "forget"], timeout=20)
        ok = result.get("exit_code") == 0
        return _action_response(ok, "telemetry_forget", result=result, message="Telemetry wurde deaktiviert" if ok else "Telemetry konnte nicht aktualisiert werden")

    return await asyncio.to_thread(_run)


@router.post("/rtk/reapply-agents")
async def diag_rtk_reapply_agents(request: Request):
    await _require_admin(request)

    def _run():
        Path.home().joinpath(".cursor").mkdir(parents=True, exist_ok=True)
        commands = [
            ["init", "-g", "--auto-patch"],
            ["init", "-g", "--codex"],
            ["init", "-g", "--gemini", "--auto-patch"],
            ["init", "-g", "--agent", "hermes"],
            ["init", "-g", "--agent", "cursor"],
        ]
        runs = [_run_rtk_command(cmd, timeout=30) for cmd in commands]
        ok = all(run.get("exit_code") == 0 for run in runs)
        return _action_response(ok, "reapply_agents", result={"runs": runs}, message="Agent-Dateien wurden neu erzeugt" if ok else "Mindestens ein Agent-Setup konnte nicht erneuert werden")

    return await asyncio.to_thread(_run)


@router.post("/rtk/rerun-rewrite-tests")
async def diag_rtk_rerun_rewrite_tests(request: Request):
    await _require_admin(request)

    def _run():
        status = _build_rtk_status_payload()
        samples = status.get("rewrite_samples", [])
        rewritten = sum(1 for sample in samples if sample.get("rewritten"))
        passthrough = sum(1 for sample in samples if sample.get("status") == "passthrough")
        result = {
            "samples": samples,
            "summary": {
                "rewritten": rewritten,
                "passthrough": passthrough,
                "total": len(samples),
            },
        }
        payload = {
            "ok": True,
            "action": "rerun_rewrite_tests",
            "message": "Rewrite-Tests wurden neu ausgeführt",
            "result": result,
            "status": status,
        }
        return payload

    return await asyncio.to_thread(_run)



# ═══════════════════════════════════════════════════════════════════
# DEEP HEALTH CHECK — 1-Request System Snapshot
# ═══════════════════════════════════════════════════════════════════

def _key_status(value, min_len: int = 8) -> dict:
    """Bewertet ob ein Key/Env-Var konfiguriert ist (nicht leer + ausreichend lang)."""
    if not value:
        return {"configured": False, "length": 0, "preview": None}
    v = str(value).strip()
    ok = len(v) >= min_len
    return {
        "configured": ok,
        "length": len(v),
        "preview": (v[:4] + "..." + v[-2:]) if ok and len(v) > 10 else "***",
    }


async def _check_mongo() -> dict:
    """Ping MongoDB + sample collection counts."""
    t0 = time.perf_counter()
    try:
        await db.command("ping")
        ping_ms = round((time.perf_counter() - t0) * 1000, 2)
        users = await db.users.estimated_document_count()
        merchants = await db.merchants.estimated_document_count()
        return {
            "status": "ok",
            "ping_ms": ping_ms,
            "collections": {"users": users, "merchants": merchants},
        }
    except Exception as e:
        return {"status": "error", "error": str(e), "ping_ms": None}


async def _check_bot_loop() -> dict:
    """Letzte Bot-Bid Timestamps aus DB."""
    try:
        latest = await db.bids.find({"bot": True}, {"_id": 0, "created_at": 1}).sort("created_at", -1).limit(1).to_list(1)
        if not latest:
            return {"status": "idle", "last_bid_at": None, "age_seconds": None}
        last_str = latest[0].get("created_at")
        if isinstance(last_str, str):
            last_dt = datetime.fromisoformat(last_str.replace("Z", "+00:00"))
        else:
            last_dt = last_str
        age = (datetime.now(timezone.utc) - last_dt).total_seconds()
        status = "ok" if age < 300 else "stale"
        return {"status": status, "last_bid_at": last_dt.isoformat(), "age_seconds": round(age, 1)}
    except Exception as e:
        return {"status": "error", "error": str(e)}


@router.get("/health-deep")
async def health_deep(request: Request):
    """Ein-Request Deep-Health-Check über alle Systemkomponenten (Admin-only)."""
    await _require_admin(request)
    return await _build_health_payload(detailed=True)


@router.get("/health/probe")
async def health_probe(request: Request):
    """Public Probe-Mode für externe Monitore (UptimeRobot/BetterStack/Healthchecks.io).
    Liefert nur Status-Code + minimale Issue-Liste, keine Keys/Previews/PII.
    HTTP 200 bei status=ok, 503 bei degraded/critical für einfache Monitor-Regeln.

    Optionaler Anti-Polling-Abuse: wenn ENV `HEALTH_PROBE_TOKEN` gesetzt ist, muss
    Header `X-Probe-Token: <token>` oder Query `?token=<token>` mitgesendet werden.
    """
    expected_token = os.environ.get("HEALTH_PROBE_TOKEN", "").strip()
    if expected_token:
        provided = (
            request.headers.get("x-probe-token")
            or request.query_params.get("token")
            or ""
        ).strip()
        if provided != expected_token:
            raise HTTPException(401, "Invalid or missing probe token")

    payload = await _build_health_payload(detailed=False)
    status_code = 200 if payload["status"] == "ok" else 503
    from fastapi.responses import JSONResponse
    return JSONResponse(content=payload, status_code=status_code)


async def _build_health_payload(detailed: bool) -> dict:
    """Shared health-check builder. `detailed=False` für Public-Probe (keine Previews)."""
    started = time.perf_counter()

    # Run async checks in parallel
    mongo_state, bot_state = await asyncio.gather(_check_mongo(), _check_bot_loop())

    # Env / Key checks
    stripe_key = os.environ.get("STRIPE_API_KEY", "")
    integrations = {
        "stripe": {
            **_key_status(stripe_key),
            "mode": "test" if stripe_key.startswith("sk_test_") else ("live" if stripe_key.startswith("sk_live_") else "unknown"),
        },
        "emergent_llm": _key_status(os.environ.get("EMERGENT_LLM_KEY")),
        "resend_email": _key_status(os.environ.get("RESEND_API_KEY")),
        "elevenlabs": _key_status(os.environ.get("ELEVENLABS_API_KEY")),
        "mapbox": _key_status(os.environ.get("MAPBOX_TOKEN")),
        "vapid_push": {
            "public_key": _key_status(os.environ.get("VAPID_PUBLIC_KEY"), min_len=40),
            "private_key": _key_status(os.environ.get("VAPID_PRIVATE_KEY"), min_len=20),
            "subject": os.environ.get("VAPID_SUBJECT") or None,
        },
        "sabre": {
            "environment": os.environ.get("SABRE_ENVIRONMENT") or "unknown",
            "cert_client_id": _key_status(os.environ.get("SABRE_CERT_CLIENT_ID")),
            "cert_client_secret": _key_status(os.environ.get("SABRE_CERT_CLIENT_SECRET")),
            "prod_client_id": _key_status(os.environ.get("SABRE_PROD_CLIENT_ID")),
        },
        "livekit": {
            "url": os.environ.get("LIVEKIT_URL") or None,
            "api_key": _key_status(os.environ.get("LIVEKIT_API_KEY")),
            "api_secret": _key_status(os.environ.get("LIVEKIT_API_SECRET")),
        },
        "sentry": _key_status(os.environ.get("SENTRY_DSN"), min_len=20),
    }

    # Routing state
    reg = get_registration_state()
    routing = {
        "registered": reg.get("total_registered", 0),
        "failed": reg.get("total_failed", 0),
        "failed_modules": [f["module"] for f in reg.get("failed", [])],
    }

    # Compute overall status
    critical_issues = []
    if mongo_state.get("status") != "ok":
        critical_issues.append("mongo")
    if routing["failed"] > 0:
        critical_issues.append("routing")
    if not integrations["emergent_llm"]["configured"]:
        critical_issues.append("emergent_llm_missing")

    warnings = []
    if not integrations["stripe"]["configured"]:
        warnings.append("stripe_unconfigured")
    if not integrations["elevenlabs"]["configured"]:
        warnings.append("elevenlabs_unconfigured")
    if not integrations["mapbox"]["configured"]:
        warnings.append("mapbox_unconfigured")
    if bot_state.get("status") == "stale":
        warnings.append("bot_loop_stale")

    overall = "ok" if not critical_issues else "degraded"
    if mongo_state.get("status") == "error":
        overall = "critical"

    elapsed_ms = round((time.perf_counter() - started) * 1000, 2)

    # Public probe: strip previews/keys/PII
    if not detailed:
        return {
            "status": overall,
            "checked_at": datetime.now(timezone.utc).isoformat(),
            "elapsed_ms": elapsed_ms,
            "critical_issues": critical_issues,
            "warnings": warnings,
            "components": {
                "mongo": mongo_state.get("status"),
                "routing_registered": routing["registered"],
                "routing_failed": routing["failed"],
                "bot_loop": bot_state.get("status"),
            },
        }

    return {
        "status": overall,
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "elapsed_ms": elapsed_ms,
        "critical_issues": critical_issues,
        "warnings": warnings,
        "components": {
            "mongo": mongo_state,
            "bot_loop": bot_state,
            "routing": routing,
            "integrations": integrations,
        },
        "environment": {
            "node": os.environ.get("ENV") or "preview",
            "frontend_url": os.environ.get("FRONTEND_URL"),
        },
    }


# ═══════════════════════════════════════════════════════════════════
# ONE-TIME DATA MIGRATIONS
# ═══════════════════════════════════════════════════════════════════

@router.get("/migrations/audit-log-actor-id/preview")
async def migration_audit_log_preview(request: Request):
    """Zeigt wie viele pos_audit_log Records dict-actor_id haben (Migration nicht ausgeführt)."""
    await _require_admin(request)
    total = await db.pos_audit_log.count_documents({})
    legacy = await db.pos_audit_log.count_documents({"actor_id": {"$type": "object"}})
    valid_str = await db.pos_audit_log.count_documents({"actor_id": {"$type": "string"}})

    # Sample one legacy record
    sample = await db.pos_audit_log.find_one({"actor_id": {"$type": "object"}}, {"_id": 0})

    def _stringify(value):
        """Recursively convert ObjectId/datetime to JSON-safe primitives."""
        if value is None or isinstance(value, (str, int, float, bool)):
            return value
        if isinstance(value, dict):
            return {k: _stringify(v) for k, v in value.items()}
        if isinstance(value, list):
            return [_stringify(v) for v in value]
        return str(value)

    return {
        "total_records": total,
        "legacy_dict_actor_id": legacy,
        "valid_string_actor_id": valid_str,
        "needs_migration": legacy,
        "sample_legacy": _stringify(sample),
    }


@router.post("/migrations/audit-log-actor-id/run")
async def migration_audit_log_run(request: Request):
    """Normalisiert legacy dict-actor_id im pos_audit_log zu plain user_id strings.

    Strategie pro Record:
      - actor_id ist dict → extract _id/id/user_id Feld; fallback "system"
      - admin_email wird zusätzlich aus dict.email gepullt (falls vorhanden)
      - Original-dict wird zu actor_id_legacy backup-gespeichert
    """
    admin = await _require_admin(request)

    SENSITIVE_FIELDS = {
        "password", "password_hash", "payment_barcode", "card_number",
        "card_expiry", "referral_code", "force_restart", "force_restart_at",
        "last_seen", "balance", "balance_blz",
    }

    cursor = db.pos_audit_log.find({"actor_id": {"$type": "object"}})
    fixed = 0
    failed = 0

    async for record in cursor:
        try:
            legacy = record.get("actor_id") or {}
            extracted_id = (
                legacy.get("_id")
                or legacy.get("id")
                or legacy.get("user_id")
                or ""
            )
            # Redact sensitive fields from the legacy backup
            legacy_safe = {
                k: ("***REDACTED***" if k in SENSITIVE_FIELDS else v)
                for k, v in legacy.items()
            }
            update_doc = {
                "actor_id": str(extracted_id) if extracted_id else "system",
                "actor_id_legacy": legacy_safe,
                "migrated_at": datetime.now(timezone.utc).isoformat(),
                "migrated_by": admin.get("email", "admin"),
            }
            if legacy.get("email"):
                update_doc["admin_email"] = legacy["email"]

            await db.pos_audit_log.update_one(
                {"_id": record["_id"]},
                {"$set": update_doc},
            )
            fixed += 1
        except Exception:
            failed += 1

    # ALSO redact any already-migrated legacy backups that still hold sensitive fields
    redacted_existing = 0
    cursor2 = db.pos_audit_log.find({
        "actor_id_legacy": {"$exists": True},
        "$or": [{f"actor_id_legacy.{f}": {"$exists": True, "$ne": "***REDACTED***"}} for f in SENSITIVE_FIELDS],
    })
    async for record in cursor2:
        legacy = record.get("actor_id_legacy") or {}
        legacy_safe = {
            k: ("***REDACTED***" if k in SENSITIVE_FIELDS else v)
            for k, v in legacy.items()
        }
        await db.pos_audit_log.update_one(
            {"_id": record["_id"]},
            {"$set": {"actor_id_legacy": legacy_safe}},
        )
        redacted_existing += 1

    # Audit the migration itself
    await db.pos_audit_log.insert_one({
        "audit_id": f"MIG-{datetime.now(timezone.utc).timestamp()}",
        "actor_id": str(admin.get("_id") or ""),
        "action": "migration.audit_log_actor_id",
        "ref": {"fixed": fixed, "failed": failed, "redacted_existing": redacted_existing},
        "ts": datetime.now(timezone.utc).isoformat(),
    })

    return {
        "ok": True,
        "fixed": fixed,
        "failed": failed,
        "redacted_existing": redacted_existing,
    }


@router.post("/migrations/audit-log-actor-id/rollback")
async def migration_audit_log_rollback(request: Request):
    """Stellt die Original-actor_id Dicts aus dem actor_id_legacy Backup wieder her."""
    await _require_admin(request)

    cursor = db.pos_audit_log.find({"actor_id_legacy": {"$exists": True}})
    restored = 0
    async for record in cursor:
        legacy = record.get("actor_id_legacy")
        if legacy is None:
            continue
        await db.pos_audit_log.update_one(
            {"_id": record["_id"]},
            {
                "$set": {"actor_id": legacy},
                "$unset": {"actor_id_legacy": "", "migrated_at": "", "migrated_by": ""},
            },
        )
        restored += 1

    return {"ok": True, "restored": restored}