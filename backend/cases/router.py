"""
Cases router — minimal stub for Dev 1.
CRUD for investigation cases.
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import uuid

from dependencies import get_current_user

router = APIRouter(prefix="/api/cases", tags=["cases"])

# In-memory case store with seed data matching frontend
_cases = {
    "c-1": {
        "id": "c-1",
        "code": "RC-2026/04",
        "title": "Operation Silent Thread",
        "status": "active",
        "priority": "high",
        "openedOn": "2026-02-14",
        "leadOfficer": "Insp. Vikram Singh",
        "station": "Cyber Cell, HQ",
        "entityIds": [],
        "summary": "Investigation into a coordinated series of high-value cryptocurrency thefts targeting domestic exchanges, with suspected routing through dark web mixers.",
        "sections": ["IT Act Sec 66C", "IPC 420", "IPC 120B"],
        "description": "",
    },
    "c-2": {
        "id": "c-2",
        "code": "FIR-44/2026",
        "title": "Cross-Border Narcotics Syndicate",
        "status": "under review",
        "priority": "high",
        "openedOn": "2026-05-22",
        "leadOfficer": "ACP Sharma",
        "station": "Narcotics Control Bureau",
        "entityIds": [],
        "summary": "Large scale synthetic drug distribution network operating across three states. Initial break from a seized shipment in sector 14.",
        "sections": ["NDPS Act Sec 21", "NDPS Act Sec 27A"],
        "description": "",
    }
}


class CaseCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    fir_number: Optional[str] = None


class CaseUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None


@router.post("")
async def create_case(req: CaseCreate, user=Depends(get_current_user)):
    case_id = f"CASE-{uuid.uuid4().hex[:8].upper()}"
    _cases[case_id] = {
        "id": case_id,
        "code": req.fir_number or case_id,
        "title": req.title,
        "summary": req.description or "",
        "status": "active",
        "priority": "medium",
        "openedOn": datetime.now().isoformat()[:10],
        "leadOfficer": user.name if hasattr(user, 'name') else "Assigned Officer",
        "station": "HQ",
        "entityIds": [],
        "sections": [],
        "description": req.description,
        "fir_number": req.fir_number,
        "created_by": user.badge_id,
    }
    return _cases[case_id]


@router.get("")
async def list_cases(user=Depends(get_current_user)):
    return list(_cases.values())


@router.get("/{case_id}")
async def get_case(case_id: str, user=Depends(get_current_user)):
    case = _cases.get(case_id)
    if not case:
        return {"error": "Case not found"}
    return case


@router.patch("/{case_id}")
async def update_case(case_id: str, req: CaseUpdate, user=Depends(get_current_user)):
    case = _cases.get(case_id)
    if not case:
        return {"error": "Case not found"}
    if req.title is not None:
        case["title"] = req.title
    if req.description is not None:
        case["description"] = req.description
    if req.status is not None:
        case["status"] = req.status
    return case
