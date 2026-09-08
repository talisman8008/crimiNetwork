import os
import uuid
import shutil
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import Optional

from db.database import get_db
from dependencies import get_current_user
from db.models import User, Case, UploadedFile, ProcessingJob
from ingestion.service import process_file_background

router = APIRouter(prefix="/api", tags=["ingestion"])

ALLOWED_SOURCE_TYPES = {"fir", "cdr", "financial", "social_media", "surveillance"}
ALLOWED_EXTENSIONS = {".pdf", ".txt", ".csv", ".json"}
MAX_FILE_SIZE = 10 * 1024 * 1024 # 10 MB

@router.post("/cases/{case_id}/upload")
@router.post("/ingest/cases/{case_id}/upload") # Compatibility
async def upload_file(
    case_id: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    source_type: str = Form(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if source_type not in ALLOWED_SOURCE_TYPES:
        raise HTTPException(status_code=400, detail="Invalid source type")

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Invalid file extension")

    # Verify case and ownership
    result = await db.execute(select(Case).where(Case.id == case_id))
    case = result.scalars().first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
        
    if user.role == "INVESTIGATOR" and case.assigned_to != user.badge_id:
        raise HTTPException(status_code=403, detail="Not authorized to upload to this case")

    # Read file content to check size
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large")

    # Save file safely
    safe_filename = f"{uuid.uuid4()}{ext}"
    upload_dir = os.path.join("uploads", case_id, source_type)
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, safe_filename)

    with open(file_path, "wb") as f:
        f.write(content)

    # Create DB records
    uploaded_file = UploadedFile(
        case_id=case_id,
        filename=file.filename,
        source_type=source_type,
        file_path=file_path
    )
    db.add(uploaded_file)
    await db.commit()
    await db.refresh(uploaded_file)

    job = ProcessingJob(
        case_id=case_id,
        file_id=uploaded_file.id,
        status="queued",
        progress=0
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    # Trigger background task
    background_tasks.add_task(process_file_background, job.id, file_path, source_type, case_id)

    return {
        "job_id": job.id,
        "status": "queued",
        "entities_preview": [] # Placeholder
    }

@router.get("/cases/{case_id}/upload/status/{job_id}")
@router.get("/ingest/cases/{case_id}/upload/status/{job_id}") # Compatibility
async def get_job_status(
    case_id: str,
    job_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Verify case and ownership
    result_case = await db.execute(select(Case).where(Case.id == case_id))
    case = result_case.scalars().first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
        
    if user.role == "INVESTIGATOR" and case.assigned_to != user.badge_id:
        raise HTTPException(status_code=403, detail="Not authorized to view this case")

    result = await db.execute(select(ProcessingJob).where(ProcessingJob.id == job_id, ProcessingJob.case_id == case_id))
    job = result.scalars().first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return {
        "status": job.status,
        "progress": job.progress,
        "steps_completed": [], # Placeholder
        "error": job.error
    }
