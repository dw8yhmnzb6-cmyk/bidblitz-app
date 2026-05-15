"""
Diagnostic endpoints — Router registration state + live route inventory.

/api/diag/routes
  Admin-only. Liefert:
    - registered: alle Module die erfolgreich gemountet wurden (mit Prefix + route_count)
    - failed: Module die beim Import/Mount silent gescheitert sind (ImportError, SyntaxError, etc.)
    - paths: alle aktuell gemounteten /api/* Pfade

Verhindert dass ein Syntax-Error in einem Route-Modul stillschweigend einen ganzen
Endpoint-Bereich aussetzt (siehe iter98 Bug: express_checkout_stripe.py).
"""
from fastapi import APIRouter, HTTPException, Request
from core.security import get_current_user
from core.router_registry import get_registration_state

router = APIRouter(prefix="/api/diag", tags=["diagnostics"])


async def _require_admin(request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin access required")
    return user


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
