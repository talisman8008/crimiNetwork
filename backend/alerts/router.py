from fastapi import APIRouter, Depends, Query, HTTPException
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from db.database import get_db
from .service import get_alerts, mark_viewed
from dependencies import get_current_user, verify_case_access

router = APIRouter(prefix="/api", tags=["alerts"])

@router.get("/cases/{case_id}/alerts")
async def list_alerts(
    case_id: str,
    severity: Optional[str] = Query(None),
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    await verify_case_access(case_id, user, db)
    return await get_alerts(case_id, severity)

@router.patch("/cases/{case_id}/alerts/{alert_id}/viewed")
async def view_alert(
    case_id: str,
    alert_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    await verify_case_access(case_id, user, db)
    success = await mark_viewed(case_id, alert_id)
    if not success:
        raise HTTPException(status_code=404, detail="Alert not found for this case")
    return {"status": "ok"}