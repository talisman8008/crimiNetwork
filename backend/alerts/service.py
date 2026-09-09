import json
from typing import List, Optional
from sqlalchemy.future import select
from db.database import AsyncSessionLocal
from db.models import Alert as DBAlert

async def create_alert(case_id: str, data: dict) -> Optional[DBAlert]:
    alert_type = data.get('alert_type', 'general')
    entity_ids = sorted(data.get('entity_ids', []))
    
    async with AsyncSessionLocal() as db:
        # Deduplication check
        query = select(DBAlert).where(
            DBAlert.case_id == case_id,
            DBAlert.alert_type == alert_type
        )
        result = await db.execute(query)
        existing_alerts = result.scalars().all()
        for ea in existing_alerts:
            if json.loads(ea.entity_ids_json) == entity_ids:
                return None # Duplicate

        alert = DBAlert(
            case_id=case_id,
            alert_type=alert_type,
            title=data['title'],
            description=data['description'],
            severity=data.get('severity', 'MEDIUM'),
            entity_ids_json=json.dumps(entity_ids)
        )
        db.add(alert)
        await db.commit()
        await db.refresh(alert)
        
        print(f"[ALERT] Alert created [{alert.severity}]: {alert.title}")
        return alert

async def get_alerts(case_id: str, severity: Optional[str] = None):
    async with AsyncSessionLocal() as db:
        query = select(DBAlert).where(DBAlert.case_id == case_id)
        if severity:
            query = query.where(DBAlert.severity == severity)
        result = await db.execute(query)
        alerts = result.scalars().all()
        
        # Convert DB models to dict for response
        return [{
            "id": a.id,
            "case_id": a.case_id,
            "alert_type": a.alert_type,
            "title": a.title,
            "description": a.description,
            "severity": a.severity,
            "entity_ids": json.loads(a.entity_ids_json),
            "viewed": a.viewed,
            "timestamp": a.created_at.isoformat()
        } for a in sorted(alerts, key=lambda x: x.created_at, reverse=True)]

async def mark_viewed(case_id: str, alert_id: str) -> bool:
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(DBAlert).where(DBAlert.id == alert_id, DBAlert.case_id == case_id))
        alert = result.scalars().first()
        if alert:
            alert.viewed = True
            await db.commit()
            return True
        return False