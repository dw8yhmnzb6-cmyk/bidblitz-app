from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api/admin/legacy-restore", tags=["legacy-restore-archived"])


@router.get("")
async def legacy_restore_archived_notice():
    raise HTTPException(
        status_code=410,
        detail="Legacy restore logic was archived to backend/migrations/archived/ and is no longer available in the active application.",
    )