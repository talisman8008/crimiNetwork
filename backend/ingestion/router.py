"""
Ingestion router — minimal stub for Dev 1.
File upload endpoint that triggers the NLP pipeline.
"""

from fastapi import APIRouter, Depends, UploadFile, File, Form
from typing import Optional

from dependencies import get_current_user

router = APIRouter(prefix="/api/ingest", tags=["ingestion"])


@router.post("/cases/{case_id}/upload")
async def upload_file(
    case_id: str,
    file: UploadFile = File(...),
    source_type: str = Form("fir"),
    user=Depends(get_current_user),
):
    """
    Upload a file (FIR PDF, CDR CSV, financial CSV) for processing.
    Triggers the NLP pipeline (Dev 2) after parsing.
    """
    content = await file.read()

    # For now, return a stub response.
    # Dev 1 will implement actual parsing and call nlp.router.process()
    return {
        "status": "uploaded",
        "case_id": case_id,
        "filename": file.filename,
        "source_type": source_type,
        "size_bytes": len(content),
        "message": "File received. Parsing not yet implemented — awaiting Dev 1.",
    }
