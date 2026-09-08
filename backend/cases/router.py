from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from db.database import get_db
from dependencies import get_current_user, require_supervisor
from cases.schemas import CaseCreate, CaseUpdate, CaseResponse
from cases.service import create_case, get_cases, get_case, update_case, delete_case
from db.models import User, Case

router = APIRouter(prefix="/api/cases", tags=["cases"])

def map_case_to_response(case: Case) -> dict:
    return {
        "id": case.id,
        "name": case.name,
        "fir_number": case.fir_number,
        "status": case.status,
        "entity_count": 0, # Placeholder
        "last_updated": case.updated_at,
        "sources_uploaded": [f.filename for f in case.uploaded_files] if case.uploaded_files else [],
        "assigned_to": case.assigned_to,
        
        # Frontend compatibility fields
        "title": case.name,
        "code": case.fir_number or case.id[:8],
        "summary": case.description or "",
        "priority": "high", # default
        "openedOn": case.date_filed or case.created_at.strftime("%Y-%m-%d"),
        "leadOfficer": case.assigned_user.name if case.assigned_user else "Assigned Officer",
        "station": "HQ",
        "sections": []
    }

@router.post("", response_model=CaseResponse)
async def create_case_endpoint(req: CaseCreate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    case = await create_case(db, req, user)
    # Refresh to get assigned_user relation
    case = await get_case(db, case.id, user)
    return map_case_to_response(case)

@router.get("", response_model=List[CaseResponse])
async def list_cases(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    cases = await get_cases(db, user)
    return [map_case_to_response(c) for c in cases]

@router.get("/{case_id}", response_model=CaseResponse)
async def get_case_endpoint(case_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    case = await get_case(db, case_id, user)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return map_case_to_response(case)

@router.patch("/{case_id}", response_model=CaseResponse)
async def update_case_endpoint(case_id: str, req: CaseUpdate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    case = await update_case(db, case_id, req, user)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return map_case_to_response(case)

@router.delete("/{case_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_case_endpoint(case_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(require_supervisor)):
    success = await delete_case(db, case_id)
    if not success:
        raise HTTPException(status_code=404, detail="Case not found")
    return None
