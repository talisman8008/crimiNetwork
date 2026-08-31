from fastapi import APIRouter, Depends
from pydantic import BaseModel
from .generator import generate_report
from dependencies import get_current_user
import uuid

router = APIRouter(prefix="/api", tags=["reports"])

_jobs = {}

class ReportRequest(BaseModel):
    report_type: str = "full"
    format: str = "txt"

@router.post("/cases/{case_id}/reports")
async def create_report(
    case_id: str,
    request: ReportRequest,
    user=Depends(get_current_user)
):
    job_id = str(uuid.uuid4())
    _jobs[job_id] = {"status": "processing", "download_url": None}
    
    path = await generate_report(case_id, request.report_type, request.format)
    _jobs[job_id] = {"status": "complete", "download_url": path}
    
    return {"job_id": job_id}

@router.get("/cases/{case_id}/reports/{job_id}")
async def get_report(
    case_id: str,
    job_id: str,
    user=Depends(get_current_user)
):
    job = _jobs.get(job_id)
    if not job:
        return {"status": "not_found"}
    return job