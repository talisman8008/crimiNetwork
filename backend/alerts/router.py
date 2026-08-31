from fastapi import APIRouter, Depends, Query
from typing import Optional
from .service import get_alerts, mark_viewed
from dependencies import get_current_user

router = APIRouter(prefix="/api", tags=["alerts"])

@router.get("/cases/{case_id}/alerts")
async def list_alerts(
    case_id: str,
    severity: Optional[str] = Query(None),
    user=Depends(get_current_user)
):
    alerts = await get_alerts(case_id, severity)
    return [
        {
            "id": a.id,
            "severity": a.severity,
            "title": a.title,
            "description": a.description,
            "entity_ids": a.entity_ids,
            "alert_type": a.alert_type,
            "timestamp": a.timestamp,
            "viewed": a.viewed
        }
        for a in alerts
    ]

@router.patch("/cases/{case_id}/alerts/{alert_id}/viewed")
async def view_alert(
    case_id: str,
    alert_id: str,
    user=Depends(get_current_user)
):
    await mark_viewed(alert_id)
    return {"status": "ok"}