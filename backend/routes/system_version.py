from fastapi import APIRouter, Request

from core.versioning import get_system_version_payload


router = APIRouter(prefix="/api/system", tags=["system"])


@router.get("/version")
async def get_system_version(request: Request):
    return get_system_version_payload(request)
