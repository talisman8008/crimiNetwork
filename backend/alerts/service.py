from dataclasses import dataclass
from datetime import datetime
from typing import List, Optional
import uuid
from db.neo4j import run_query

# In-memory store for hackathon (replace with DB in production)
_alerts = {}

@dataclass
class Alert:
    id: str
    case_id: str
    severity: str
    title: str
    description: str
    entity_ids: List[str]
    alert_type: str
    timestamp: str
    viewed: bool = False

async def create_alert(case_id: str, data: dict) -> Alert:
    alert = Alert(
        id=str(uuid.uuid4()),
        case_id=case_id,
        severity=data.get('severity', 'MEDIUM'),
        title=data['title'],
        description=data['description'],
        entity_ids=data.get('entity_ids', []),
        alert_type=data.get('alert_type', 'general'),
        timestamp=datetime.now().isoformat(),
        viewed=False
    )
    
    if case_id not in _alerts:
        _alerts[case_id] = []
    _alerts[case_id].append(alert)
    
    print(f"🔔 Alert created [{alert.severity}]: {alert.title}")
    return alert

async def get_alerts(case_id: str, severity: Optional[str] = None) -> List[Alert]:
    alerts = _alerts.get(case_id, [])
    if severity:
        alerts = [a for a in alerts if a.severity == severity]
    return sorted(alerts, key=lambda a: a.timestamp, reverse=True)

async def mark_viewed(alert_id: str):
    for case_alerts in _alerts.values():
        for alert in case_alerts:
            if alert.id == alert_id:
                alert.viewed = True
                return