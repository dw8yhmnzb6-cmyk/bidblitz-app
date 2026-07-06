from fastapi import APIRouter

router = APIRouter(prefix="/api", tags=["feature-flags"])


@router.get("/feature-flags")
async def public_feature_flags():
    from core.feature_flags import get_all_flags

    flags = await get_all_flags()
    result = {}
    for key, value in flags.items():
        if not isinstance(value, dict):
            continue
        result[key] = {
            "enabled": value.get("enabled", False),
            "access": value.get("access", "all"),
        }
    return {"flags": result}